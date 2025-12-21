-- Core Runtime + Webchat + RAG (Core tables, RLS, RPC)
-- Safe, additive migration for Tamm

-- Extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- Helpers
-- =========================================================
DO $$
BEGIN
  -- Ensure updated_at trigger function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

-- =========================================================
-- Agents (extend existing)
-- =========================================================
DO $$
BEGIN
  -- Add missing columns (additive)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agents') THEN
    ALTER TABLE public.agents
      ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'sales',
      ADD COLUMN IF NOT EXISTS tone TEXT DEFAULT 'friendly',
      ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ar',
      ADD COLUMN IF NOT EXISTS auto_detect_language BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS system_prompt TEXT,
      ADD COLUMN IF NOT EXISTS rules_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS human_handoff_enabled BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS inventory_substitution_enabled BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      ADD COLUMN IF NOT EXISTS temperature NUMERIC NOT NULL DEFAULT 0.4,
      ADD COLUMN IF NOT EXISTS max_tokens INT NOT NULL DEFAULT 800,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS trained_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    -- Try to convert existing rules TEXT to JSONB if it looks like JSON
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='agents' AND column_name='rules'
    ) THEN
      BEGIN
        UPDATE public.agents
          SET rules_jsonb = COALESCE(NULLIF(rules,'')::jsonb, '{}'::jsonb)
        WHERE (rules IS NOT NULL AND rules <> '') AND rules_jsonb = '{}'::jsonb;
      EXCEPTION WHEN others THEN
        -- ignore malformed JSON
        NULL;
      END;
    END IF;
  END IF;
END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_agents_updated_at ON public.agents;
CREATE TRIGGER trg_agents_updated_at
BEFORE UPDATE ON public.agents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Channels (extend existing)
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='channels') THEN
    ALTER TABLE public.channels
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;
    -- keep existing metadata, but mirror into config if config empty
    UPDATE public.channels
      SET config = COALESCE(NULLIF(metadata::text,'{}')::jsonb, '{}'::jsonb)
    WHERE config = '{}'::jsonb AND metadata IS NOT NULL;
  END IF;
END $$;

-- =========================================================
-- Channel <-> Agent mapping
-- =========================================================
CREATE TABLE IF NOT EXISTS public.channel_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'general',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, agent_id)
);

-- =========================================================
-- Conversations (extend existing)
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='conversations') THEN
    ALTER TABLE public.conversations
      ADD COLUMN IF NOT EXISTS external_user_id TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
      ADD COLUMN IF NOT EXISTS handoff_reason TEXT,
      ADD COLUMN IF NOT EXISTS channel_id UUID,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    -- ensure channel_id FK
    BEGIN
      ALTER TABLE public.conversations
        ADD CONSTRAINT conversations_channel_fk
        FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_conversations_workspace_channel_user
  ON public.conversations (workspace_id, channel_id, external_user_id);

-- =========================================================
-- Channel messages
-- =========================================================
CREATE TABLE IF NOT EXISTS public.channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer','ai','human')),
  message_text TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_conversation_created
  ON public.channel_messages (conversation_id, created_at);

-- =========================================================
-- Orders (extend existing)
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='orders') THEN
    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS phone TEXT,
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS total NUMERIC,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_confirmation',
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Tickets
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  category TEXT,
  priority TEXT,
  assignee_user_id UUID NULL,
  sla_due_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON public.tickets;
CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Knowledge chunks: add workspace + embedding to existing table
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='knowledge_chunks') THEN
    ALTER TABLE public.knowledge_chunks
      ADD COLUMN IF NOT EXISTS workspace_id UUID,
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS embedding vector(1536);
    -- backfill workspace_id from source
    UPDATE public.knowledge_chunks kc
      SET workspace_id = ks.workspace_id
    FROM public.knowledge_sources ks
    WHERE kc.source_id = ks.id AND kc.workspace_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_workspace_source
  ON public.knowledge_chunks (workspace_id, source_id);

-- vector index (HNSW if available)
DO $$
BEGIN
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw
    ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);
  EXCEPTION WHEN others THEN
    -- fallback ivfflat
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_ivfflat
      ON public.knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    EXCEPTION WHEN others THEN NULL;
    END;
  END;
END $$;

-- =========================================================
-- Workspace settings
-- =========================================================
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  retention_days INT NOT NULL DEFAULT 365,
  inbox_style TEXT NOT NULL DEFAULT 'omni',
  notifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_workspace_settings_updated_at ON public.workspace_settings;
CREATE TRIGGER trg_workspace_settings_updated_at
BEFORE UPDATE ON public.workspace_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Usage counters (monthly)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_yyyymm TEXT NOT NULL,
  messages_in INT NOT NULL DEFAULT 0,
  messages_out INT NOT NULL DEFAULT 0,
  kb_bytes BIGINT NOT NULL DEFAULT 0,
  channels_count INT NOT NULL DEFAULT 0,
  agents_count INT NOT NULL DEFAULT 0,
  sources_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, period_yyyymm)
);

-- =========================================================
-- Audit logs
-- =========================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- Tamm admins (internal)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tamm_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- RLS (client-facing)
-- =========================================================
ALTER TABLE public.channel_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tamm_admins ENABLE ROW LEVEL SECURITY;

-- Standard membership-based policies
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agents','channels','channel_agents','conversations','channel_messages','orders','tickets',
    'knowledge_sources','knowledge_chunks','workspace_settings','usage_counters','audit_logs'
  ]
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "tamm_member_select" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "tamm_member_insert" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "tamm_member_update" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "tamm_member_delete" ON public.%I', t);

      EXECUTE format($pol$
        CREATE POLICY "tamm_member_select" ON public.%I
        FOR SELECT TO authenticated
        USING (public.is_workspace_member(workspace_id));
      $pol$, t);

      EXECUTE format($pol$
        CREATE POLICY "tamm_member_insert" ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (public.is_workspace_member(workspace_id));
      $pol$, t);

      EXECUTE format($pol$
        CREATE POLICY "tamm_member_update" ON public.%I
        FOR UPDATE TO authenticated
        USING (public.is_workspace_member(workspace_id))
        WITH CHECK (public.is_workspace_member(workspace_id));
      $pol$, t);

      EXECUTE format($pol$
        CREATE POLICY "tamm_member_delete" ON public.%I
        FOR DELETE TO authenticated
        USING (public.is_workspace_member(workspace_id));
      $pol$, t);
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Tamm admins: self-only by default, or member of tamm_admins
DROP POLICY IF EXISTS "tamm_admins_select" ON public.tamm_admins;
CREATE POLICY "tamm_admins_select" ON public.tamm_admins
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tamm_admins ta WHERE ta.user_id = auth.uid()));

DROP POLICY IF EXISTS "tamm_admins_insert" ON public.tamm_admins;
CREATE POLICY "tamm_admins_insert" ON public.tamm_admins
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.tamm_admins ta WHERE ta.user_id = auth.uid()));

DROP POLICY IF EXISTS "tamm_admins_delete" ON public.tamm_admins;
CREATE POLICY "tamm_admins_delete" ON public.tamm_admins
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.tamm_admins ta WHERE ta.user_id = auth.uid()));

-- =========================================================
-- RPC: match_knowledge_chunks (workspace-scoped)
-- =========================================================
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  p_workspace_id uuid,
  p_query_embedding vector(1536),
  p_top_k int DEFAULT 8,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    kc.id,
    kc.source_id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> p_query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  WHERE kc.workspace_id = p_workspace_id
    AND kc.embedding IS NOT NULL
    AND (
      p_filters = '{}'::jsonb
      OR kc.metadata @> p_filters
    )
  ORDER BY kc.embedding <=> p_query_embedding
  LIMIT GREATEST(p_top_k, 1);
$$;

-- Allow authenticated users to call the RPC (workspace filtering happens in function + RLS on table)
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(uuid, vector, int, jsonb) TO authenticated;
