-- ZIP 3: Usage gating, retention cleanup helpers, draft sending

-- 1) Ensure workspace_settings has plan_tier (if not already)
ALTER TABLE IF EXISTS public.workspace_settings
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free';

-- 2) Ensure unique key for upsert
CREATE UNIQUE INDEX IF NOT EXISTS usage_counters_workspace_period_uq ON public.usage_counters (workspace_id, period_yyyymm);

-- 3) Atomic usage counters bump RPC
CREATE OR REPLACE FUNCTION public.bump_usage_counters(
  p_workspace_id UUID,
  p_period_yyyymm TEXT,
  p_delta_in INT DEFAULT 0,
  p_delta_out INT DEFAULT 0,
  p_delta_kb_bytes BIGINT DEFAULT 0,
  p_channels_count INT DEFAULT NULL,
  p_agents_count INT DEFAULT NULL,
  p_sources_count INT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.usage_counters (
    id, workspace_id, period_yyyymm,
    messages_in, messages_out, kb_bytes,
    channels_count, agents_count, sources_count
  )
  VALUES (
    gen_random_uuid(), p_workspace_id, p_period_yyyymm,
    GREATEST(p_delta_in,0), GREATEST(p_delta_out,0), GREATEST(p_delta_kb_bytes,0),
    COALESCE(p_channels_count,0), COALESCE(p_agents_count,0), COALESCE(p_sources_count,0)
  )
  ON CONFLICT (workspace_id, period_yyyymm)
  DO UPDATE SET
    messages_in = COALESCE(public.usage_counters.messages_in,0) + GREATEST(p_delta_in,0),
    messages_out = COALESCE(public.usage_counters.messages_out,0) + GREATEST(p_delta_out,0),
    kb_bytes = COALESCE(public.usage_counters.kb_bytes,0) + GREATEST(p_delta_kb_bytes,0),
    channels_count = COALESCE(p_channels_count, public.usage_counters.channels_count),
    agents_count = COALESCE(p_agents_count, public.usage_counters.agents_count),
    sources_count = COALESCE(p_sources_count, public.usage_counters.sources_count);
END;
$$;

REVOKE ALL ON FUNCTION public.bump_usage_counters(UUID, TEXT, INT, INT, BIGINT, INT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_usage_counters(UUID, TEXT, INT, INT, BIGINT, INT, INT, INT) TO service_role;

-- 3) Retention cleanup SQL helper (delete old data for all workspaces)
CREATE OR REPLACE FUNCTION public.run_retention_cleanup()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ws RECORD;
  keep_days INT;
BEGIN
  FOR ws IN SELECT id FROM public.workspaces LOOP
    SELECT COALESCE(retention_days, 365) INTO keep_days
    FROM public.workspace_settings
    WHERE workspace_id = ws.id;

    -- messages
    DELETE FROM public.channel_messages
    WHERE workspace_id = ws.id
      AND created_at < (now() - make_interval(days => keep_days));

    -- conversations (only if no messages remain)
    DELETE FROM public.conversations c
    WHERE c.workspace_id = ws.id
      AND c.created_at < (now() - make_interval(days => keep_days))
      AND NOT EXISTS (
        SELECT 1 FROM public.channel_messages m WHERE m.conversation_id = c.id
      );

    -- orders & tickets (keep same retention)
    DELETE FROM public.orders
    WHERE workspace_id = ws.id
      AND created_at < (now() - make_interval(days => keep_days));

    DELETE FROM public.tickets
    WHERE workspace_id = ws.id
      AND created_at < (now() - make_interval(days => keep_days));

    -- audit logs (optional, keep 2x retention)
    DELETE FROM public.audit_logs
    WHERE workspace_id = ws.id
      AND created_at < (now() - make_interval(days => keep_days*2));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.run_retention_cleanup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_retention_cleanup() TO service_role;

-- 4) Small index improvements
CREATE INDEX IF NOT EXISTS channel_messages_workspace_created_idx
  ON public.channel_messages (workspace_id, created_at DESC);
