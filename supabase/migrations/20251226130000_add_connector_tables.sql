-- Add connector tables for external system ingestion

-- public.connectors table
CREATE TABLE public.connectors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type text NOT NULL, -- e.g., 'HR', 'CRM', 'ERP', 'SaaS_Integration'
  name text NOT NULL,
  config_jsonb jsonb NOT NULL, -- Encrypted configuration details (e.g., API keys, endpoint URLs)
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Workspace admins can manage (CRUD) their own connectors
DROP POLICY IF EXISTS "workspace_admin_can_manage_connectors" ON public.connectors;
CREATE POLICY "workspace_admin_can_manage_connectors"
ON public.connectors
FOR ALL
TO authenticated
USING (
    public.is_admin() AND public.is_workspace_member(workspace_id)
)
WITH CHECK (
    public.is_admin() AND public.is_workspace_member(workspace_id)
);

-- RLS Policy: Workspace members can read active connectors (for UI display, etc.)
DROP POLICY IF EXISTS "workspace_member_can_read_active_connectors" ON public.connectors;
CREATE POLICY "workspace_member_can_read_active_connectors"
ON public.connectors
FOR SELECT
TO authenticated
USING (
    is_active = TRUE AND public.is_workspace_member(workspace_id)
);


-- public.connector_runs table
CREATE TABLE public.connector_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id uuid NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued', -- e.g., 'queued', 'running', 'completed', 'failed'
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb, -- e.g. number of records processed, data range, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.connector_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Workspace members can read their connector runs
-- Condition: connector_runs.connector_id -> connectors.workspace_id = public.get_current_workspace_id()
DROP POLICY IF EXISTS "workspace_member_can_read_connector_runs" ON public.connector_runs;
CREATE POLICY "workspace_member_can_read_connector_runs"
ON public.connector_runs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.connectors c
        WHERE c.id = connector_id AND public.is_workspace_member(c.workspace_id)
    )
);

-- RLS Policy: System/Admin can insert connector runs (triggered by backend/scheduler)
DROP POLICY IF EXISTS "system_can_insert_connector_runs" ON public.connector_runs;
CREATE POLICY "system_can_insert_connector_runs"
ON public.connector_runs
FOR INSERT
TO authenticated -- Or 'service_role' if using a separate user
WITH CHECK (
    public.is_admin() OR auth.role() = 'service_role' -- Example: allow service_role to insert
);

-- RLS Policy: System/Admin can update connector runs
DROP POLICY IF EXISTS "system_can_update_connector_runs" ON public.connector_runs;
CREATE POLICY "system_can_update_connector_runs"
ON public.connector_runs
FOR UPDATE
TO authenticated -- Or 'service_role'
USING (
    public.is_admin() OR auth.role() = 'service_role'
)
WITH CHECK (
    public.is_admin() OR auth.role() = 'service_role'
);


-- public.ingestion_logs table
CREATE TABLE public.ingestion_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_run_id uuid NOT NULL REFERENCES public.connector_runs(id) ON DELETE CASCADE,
  level text NOT NULL, -- e.g., 'INFO', 'WARN', 'ERROR'
  message text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  metadata jsonb -- Additional context for the log entry
);

ALTER TABLE public.ingestion_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Workspace members can read ingestion logs for their connectors
DROP POLICY IF EXISTS "workspace_member_can_read_ingestion_logs" ON public.ingestion_logs;
CREATE POLICY "workspace_member_can_read_ingestion_logs"
ON public.ingestion_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.connector_runs cr
        JOIN public.connectors c ON cr.connector_id = c.id
        WHERE cr.id = connector_run_id AND public.is_workspace_member(c.workspace_id)
    )
);

-- RLS Policy: System/Admin can insert ingestion logs
DROP POLICY IF EXISTS "system_can_insert_ingestion_logs" ON public.ingestion_logs;
CREATE POLICY "system_can_insert_ingestion_logs"
ON public.ingestion_logs
FOR INSERT
TO authenticated -- Or 'service_role'
WITH CHECK (
    public.is_admin() OR auth.role() = 'service_role'
);
