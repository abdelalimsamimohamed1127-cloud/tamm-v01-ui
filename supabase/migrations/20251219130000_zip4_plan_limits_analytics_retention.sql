-- ZIP 4: DB-enforced plan limits, plan-aware retention defaults, analytics helpers

-- 1) Helper: effective plan tier + retention days
CREATE OR REPLACE FUNCTION public.get_plan_tier(p_workspace_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT plan_tier FROM public.workspace_settings WHERE workspace_id = p_workspace_id),
    'free'
  )::text
$$;

CREATE OR REPLACE FUNCTION public.effective_retention_days(p_workspace_id uuid)
RETURNS int
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tier text;
  configured int;
BEGIN
  SELECT plan_tier, retention_days INTO tier, configured
  FROM public.workspace_settings
  WHERE workspace_id = p_workspace_id;

  tier := COALESCE(lower(tier), 'free');

  IF configured IS NOT NULL AND configured > 0 THEN
    RETURN configured;
  END IF;

  -- defaults by tier
  IF tier = 'paid3' THEN
    RETURN 1095; -- 3 years
  ELSIF tier = 'paid2' THEN
    RETURN 365; -- 1 year
  ELSIF tier = 'paid1' THEN
    RETURN 180; -- ~6 months
  ELSE
    RETURN 30; -- free: 30 days
  END IF;
END;
$$;

-- 2) DB-enforced plan limits (agents/channels/sources)
-- NOTE: raises exception to block inserts beyond plan limits
CREATE OR REPLACE FUNCTION public._plan_limits_for_tier(p_tier text)
RETURNS TABLE(max_agents int, max_channels int, max_sources int, max_kb_bytes bigint, max_msg_out int, max_msg_in int)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  t text := COALESCE(lower(p_tier),'free');
BEGIN
  IF t = 'paid3' THEN
    RETURN QUERY SELECT 20, 20, 500, 1024*1024*1024::bigint, 100000, 200000;
  ELSIF t = 'paid2' THEN
    RETURN QUERY SELECT 5, 5, 100, 200*1024*1024::bigint, 10000, 20000;
  ELSIF t = 'paid1' THEN
    RETURN QUERY SELECT 1, 2, 20, 50*1024*1024::bigint, 2000, 4000;
  ELSE
    RETURN QUERY SELECT 1, 1, 5, 10*1024*1024::bigint, 300, 600;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_agents_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier text;
  lim record;
  n int;
BEGIN
  tier := public.get_plan_tier(NEW.workspace_id);
  SELECT * INTO lim FROM public._plan_limits_for_tier(tier) LIMIT 1;
  SELECT count(*) INTO n FROM public.agents WHERE workspace_id = NEW.workspace_id;
  IF n >= lim.max_agents THEN
    RAISE EXCEPTION 'plan_limit_exceeded:agents (tier=%)', tier USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_channels_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier text;
  lim record;
  n int;
BEGIN
  tier := public.get_plan_tier(NEW.workspace_id);
  SELECT * INTO lim FROM public._plan_limits_for_tier(tier) LIMIT 1;
  SELECT count(*) INTO n FROM public.channels WHERE workspace_id = NEW.workspace_id;
  IF n >= lim.max_channels THEN
    RAISE EXCEPTION 'plan_limit_exceeded:channels (tier=%)', tier USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_sources_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier text;
  lim record;
  n int;
BEGIN
  tier := public.get_plan_tier(NEW.workspace_id);
  SELECT * INTO lim FROM public._plan_limits_for_tier(tier) LIMIT 1;
  SELECT count(*) INTO n FROM public.knowledge_sources WHERE workspace_id = NEW.workspace_id;
  IF n >= lim.max_sources THEN
    RAISE EXCEPTION 'plan_limit_exceeded:sources (tier=%)', tier USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_agents_plan_limit') THEN
    CREATE TRIGGER trg_agents_plan_limit
    BEFORE INSERT ON public.agents
    FOR EACH ROW EXECUTE FUNCTION public.enforce_agents_plan_limit();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_channels_plan_limit') THEN
    CREATE TRIGGER trg_channels_plan_limit
    BEFORE INSERT ON public.channels
    FOR EACH ROW EXECUTE FUNCTION public.enforce_channels_plan_limit();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sources_plan_limit') THEN
    CREATE TRIGGER trg_sources_plan_limit
    BEFORE INSERT ON public.knowledge_sources
    FOR EACH ROW EXECUTE FUNCTION public.enforce_sources_plan_limit();
  END IF;
END $$;

-- 3) Replace retention cleanup to use effective_retention_days()
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
    keep_days := public.effective_retention_days(ws.id);

    DELETE FROM public.channel_messages
    WHERE workspace_id = ws.id
      AND created_at < (now() - make_interval(days => keep_days));

    DELETE FROM public.conversations c
    WHERE c.workspace_id = ws.id
      AND c.created_at < (now() - make_interval(days => keep_days))
      AND NOT EXISTS (
        SELECT 1 FROM public.channel_messages m WHERE m.conversation_id = c.id
      );

    DELETE FROM public.orders
    WHERE workspace_id = ws.id
      AND created_at < (now() - make_interval(days => keep_days));

    DELETE FROM public.tickets
    WHERE workspace_id = ws.id
      AND created_at < (now() - make_interval(days => keep_days));

  END LOOP;
END;
$$;
