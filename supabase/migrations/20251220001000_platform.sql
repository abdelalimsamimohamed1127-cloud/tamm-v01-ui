
-- ZIP9-12 Platform: Automation Rules + RAG Traces + Cost Meter + Feedback + Insights + Inbox SLA
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Workspace users for assignment metadata
CREATE TABLE IF NOT EXISTS public.workspace_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  display_name text,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
ALTER TABLE public.workspace_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "ws_users_select" ON public.workspace_users FOR SELECT
USING (public.is_workspace_member(workspace_id));
CREATE POLICY IF NOT EXISTS "ws_users_all" ON public.workspace_users FOR ALL
USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS public.conversation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  assignee_user_id uuid NOT NULL,
  assigned_at timestamptz DEFAULT now()
);
ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS conversation_assignments_ws_conv_idx ON public.conversation_assignments (workspace_id, conversation_id);
CREATE POLICY IF NOT EXISTS "conv_assign_select" ON public.conversation_assignments FOR SELECT
USING (public.is_workspace_member(workspace_id));
CREATE POLICY IF NOT EXISTS "conv_assign_all" ON public.conversation_assignments FOR ALL
USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS public.conversation_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (conversation_id, tag)
);
ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS conversation_tags_ws_conv_idx ON public.conversation_tags (workspace_id, conversation_id);
CREATE POLICY IF NOT EXISTS "conv_tags_select" ON public.conversation_tags FOR SELECT
USING (public.is_workspace_member(workspace_id));
CREATE POLICY IF NOT EXISTS "conv_tags_all" ON public.conversation_tags FOR ALL
USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS public.conversation_sla (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  conversation_id uuid NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  due_at timestamptz,
  breached_at timestamptz,
  policy jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.conversation_sla ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "conv_sla_select" ON public.conversation_sla FOR SELECT
USING (public.is_workspace_member(workspace_id));
CREATE POLICY IF NOT EXISTS "conv_sla_all" ON public.conversation_sla FOR ALL
USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS handoff_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS handoff_reason text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- Automation rules
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  trigger jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS automation_rules_ws_idx ON public.automation_rules (workspace_id);
CREATE POLICY IF NOT EXISTS "automation_rules_select" ON public.automation_rules FOR SELECT
USING (public.is_workspace_member(workspace_id));
CREATE POLICY IF NOT EXISTS "automation_rules_all" ON public.automation_rules FOR ALL
USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ok',
  logs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS automation_runs_ws_created_idx ON public.automation_runs (workspace_id, created_at DESC);
CREATE POLICY IF NOT EXISTS "automation_runs_select" ON public.automation_runs FOR SELECT
USING (public.is_workspace_member(workspace_id));
CREATE POLICY IF NOT EXISTS "automation_runs_all" ON public.automation_runs FOR ALL
USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

-- RAG traces
CREATE TABLE IF NOT EXISTS public.rag_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  conversation_id uuid,
  message_id uuid,
  query_text text NOT NULL,
  rewritten_query text,
  retrieved_chunk_ids uuid[] DEFAULT '{}'::uuid[],
  citations jsonb DEFAULT '[]'::jsonb,
  rerank_scores jsonb DEFAULT '[]'::jsonb,
  confidence numeric,
  model_cost jsonb DEFAULT '{}'::jsonb,
  latency_ms int,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_traces ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS rag_traces_ws_created_idx ON public.rag_traces (workspace_id, created_at DESC);
CREATE POLICY IF NOT EXISTS "rag_traces_select" ON public.rag_traces FOR SELECT
USING (public.is_workspace_member(workspace_id));
CREATE POLICY IF NOT EXISTS "rag_traces_all" ON public.rag_traces FOR ALL
USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

-- Cost events
CREATE TABLE IF NOT EXISTS public.cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  conversation_id uuid,
  message_id uuid,
  provider text NOT NULL DEFAULT 'openai',
  model text NOT NULL,
  input_tokens int DEFAULT 0,
  output_tokens int DEFAULT 0,
  cost_usd numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.cost_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS cost_events_ws_created_idx ON public.cost_events (workspace_id, created_at DESC);
CREATE POLICY IF NOT EXISTS "cost_events_select" ON public.cost_events FOR SELECT
USING (public.is_workspace_member(workspace_id));
CREATE POLICY IF NOT EXISTS "cost_events_all" ON public.cost_events FOR ALL
USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

-- Feedback
CREATE TABLE IF NOT EXISTS public.message_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  conversation_id uuid,
  message_id uuid,
  rating int NOT NULL CHECK (rating IN (-1, 1)),
  comment text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS message_feedback_ws_created_idx ON public.message_feedback (workspace_id, created_at DESC);
CREATE POLICY IF NOT EXISTS "message_feedback_select" ON public.message_feedback FOR SELECT
USING (public.is_workspace_member(workspace_id));
CREATE POLICY IF NOT EXISTS "message_feedback_all" ON public.message_feedback FOR ALL
USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

-- Insights
CREATE TABLE IF NOT EXISTS public.insight_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  period_yyyymm text,
  title text,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.insight_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS insight_reports_ws_created_idx ON public.insight_reports (workspace_id, created_at DESC);
CREATE POLICY IF NOT EXISTS "insight_reports_select" ON public.insight_reports FOR SELECT
USING (public.is_workspace_member(workspace_id));
CREATE POLICY IF NOT EXISTS "insight_reports_all" ON public.insight_reports FOR ALL
USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

-- Knowledge chunks: metadata + trigram index for hybrid search
ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tokens_estimate int;
CREATE INDEX IF NOT EXISTS knowledge_chunks_content_trgm_idx
ON public.knowledge_chunks USING gin (content gin_trgm_ops);
