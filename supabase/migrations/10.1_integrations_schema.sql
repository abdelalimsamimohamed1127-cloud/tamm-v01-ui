-- Migration SQL for TASK 10.1 – Integrations: DB Schema for Connectors + Canonical Entities + Ingestion Logs

-- Helper functions is_workspace_member(workspace_id) and is_workspace_admin(workspace_id) are assumed to exist.

-- 1. Create public.connectors table
CREATE TABLE IF NOT EXISTS public.connectors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    type text NOT NULL,
    name text NOT NULL,
    config jsonb NOT NULL,
    status text NOT NULL DEFAULT 'inactive',
    last_sync_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 2. Create public.ingestion_logs table
CREATE TABLE IF NOT EXISTS public.ingestion_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    connector_id uuid NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
    status text NOT NULL, -- 'success','partial','failed'
    records_processed int DEFAULT 0,
    error_summary text,
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz
);

-- 3. Create public.employee_profiles table
CREATE TABLE IF NOT EXISTS public.employee_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    external_id text, -- ID from the external HR system
    full_name text NOT NULL,
    role text,
    department text,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

-- 4. Create public.employee_events table
CREATE TABLE IF NOT EXISTS public.employee_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    payload jsonb,
    occurred_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 5. Create public.employee_kpis table
CREATE TABLE IF NOT EXISTS public.employee_kpis (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
    kpi_key text NOT NULL,
    kpi_value numeric NOT NULL,
    period_start date,
    period_end date,
    created_at timestamptz DEFAULT now()
);

-- 6. Create public.employee_complaints table
CREATE TABLE IF NOT EXISTS public.employee_complaints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
    category text,
    description text,
    status text DEFAULT 'open',
    created_at timestamptz DEFAULT now()
);

-- 7. Create public.policy_documents table
CREATE TABLE IF NOT EXISTS public.policy_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL,
    version text,
    created_at timestamptz DEFAULT now()
);


-- RLS Policies (MANDATORY)

-- Enable RLS for all new tables
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_documents ENABLE ROW LEVEL SECURITY;

-- SELECT policies
CREATE POLICY IF NOT EXISTS "workspace_members_select_connectors"
ON public.connectors FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_members_select_ingestion_logs"
ON public.ingestion_logs FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_members_select_employee_profiles"
ON public.employee_profiles FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_members_select_employee_events"
ON public.employee_events FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_members_select_employee_kpis"
ON public.employee_kpis FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_members_select_employee_complaints"
ON public.employee_complaints FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_members_select_policy_documents"
ON public.policy_documents FOR SELECT
USING (is_workspace_member(workspace_id));


-- INSERT/UPDATE/DELETE policies (Admin only)
CREATE POLICY IF NOT EXISTS "workspace_admins_manipulate_connectors"
ON public.connectors FOR ALL
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_admins_manipulate_ingestion_logs"
ON public.ingestion_logs FOR ALL
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_admins_manipulate_employee_profiles"
ON public.employee_profiles FOR ALL
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_admins_manipulate_employee_events"
ON public.employee_events FOR ALL
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_admins_manipulate_employee_kpis"
ON public.employee_kpis FOR ALL
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_admins_manipulate_employee_complaints"
ON public.employee_complaints FOR ALL
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY IF NOT EXISTS "workspace_admins_manipulate_policy_documents"
ON public.policy_documents FOR ALL
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));


-- Indexing Requirements

-- workspace_id on all tables
CREATE INDEX IF NOT EXISTS idx_connectors_workspace_id ON public.connectors (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_workspace_id ON public.ingestion_logs (workspace_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_workspace_id ON public.employee_profiles (workspace_id);
CREATE INDEX IF NOT EXISTS idx_employee_events_workspace_id ON public.employee_events (workspace_id);
CREATE INDEX IF NOT EXISTS idx_employee_kpis_workspace_id ON public.employee_kpis (workspace_id);
CREATE INDEX IF NOT EXISTS idx_employee_complaints_workspace_id ON public.employee_complaints (workspace_id);
CREATE INDEX IF NOT EXISTS idx_policy_documents_workspace_id ON public.policy_documents (workspace_id);

-- connector_id on ingestion_logs
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_connector_id ON public.ingestion_logs (connector_id);

-- employee_id on employee_events / employee_kpis / employee_complaints
CREATE INDEX IF NOT EXISTS idx_employee_events_employee_id ON public.employee_events (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_kpis_employee_id ON public.employee_kpis (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_complaints_employee_id ON public.employee_complaints (employee_id);

-- type on connectors
CREATE INDEX IF NOT EXISTS idx_connectors_type ON public.connectors (type);
