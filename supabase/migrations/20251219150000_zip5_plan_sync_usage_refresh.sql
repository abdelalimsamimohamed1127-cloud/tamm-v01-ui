-- ZIP5: plan tier sync, usage recompute RPC, upgrade requests

begin;

-- Helper: is_tamm_admin
create or replace function public.is_tamm_admin()
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.tamm_admins ta where ta.user_id = auth.uid());
$$;

-- Allow Tamm admins to manage workspace_settings across workspaces
DO $$
BEGIN
  BEGIN
    CREATE POLICY ws_select_admin ON public.workspace_settings
      FOR SELECT TO authenticated
      USING (public.is_tamm_admin());
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY ws_update_admin ON public.workspace_settings
      FOR UPDATE TO authenticated
      USING (public.is_tamm_admin())
      WITH CHECK (public.is_tamm_admin());
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY ws_insert_admin ON public.workspace_settings
      FOR INSERT TO authenticated
      WITH CHECK (public.is_tamm_admin());
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

-- Ensure workspace_settings row exists and sync plan tier with workspaces.plan
create or replace function public.ensure_workspace_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_settings (workspace_id, plan_tier)
  values (new.id, coalesce(new.plan, 'free'))
  on conflict (workspace_id) do update
    set plan_tier = excluded.plan_tier,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workspaces_ensure_settings on public.workspaces;
create trigger trg_workspaces_ensure_settings
after insert or update of plan on public.workspaces
for each row execute function public.ensure_workspace_settings();

-- Sync back: when workspace_settings.plan_tier changes, update workspaces.plan
create or replace function public.sync_workspace_plan_from_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.workspaces
    set plan = new.plan_tier
  where id = new.workspace_id
    and coalesce(plan,'') <> coalesce(new.plan_tier,'');
  return new;
end;
$$;

drop trigger if exists trg_workspace_settings_sync_plan on public.workspace_settings;
create trigger trg_workspace_settings_sync_plan
after insert or update of plan_tier on public.workspace_settings
for each row execute function public.sync_workspace_plan_from_settings();

-- Upgrade requests (client can request, admin can approve)
create table if not exists public.plan_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_tier text not null,
  to_tier text not null,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plan_upgrade_requests enable row level security;

drop policy if exists "pr_select_member" on public.plan_upgrade_requests;
create policy "pr_select_member" on public.plan_upgrade_requests
for select to authenticated
using (public.is_workspace_member(workspace_id) or public.is_tamm_admin());

drop policy if exists "pr_insert_member" on public.plan_upgrade_requests;
create policy "pr_insert_member" on public.plan_upgrade_requests
for insert to authenticated
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "pr_update_admin" on public.plan_upgrade_requests;
create policy "pr_update_admin" on public.plan_upgrade_requests
for update to authenticated
using (public.is_tamm_admin())
with check (public.is_tamm_admin());

create or replace function public.set_updated_at_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_plan_upgrade_requests_updated_at on public.plan_upgrade_requests;
create trigger trg_plan_upgrade_requests_updated_at
before update on public.plan_upgrade_requests
for each row execute function public.set_updated_at_timestamp();

-- Usage recompute: accurate counts for current period
create or replace function public.recompute_usage_counters(p_workspace_id uuid, p_period_yyyymm text default to_char(now(),'YYYYMM'))
returns public.usage_counters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.usage_counters;
  v_start timestamptz;
  v_end timestamptz;
  v_in int;
  v_out int;
  v_kb bigint;
  v_agents int;
  v_channels int;
  v_sources int;
begin
  if not (public.is_workspace_member(p_workspace_id) or public.is_tamm_admin()) then
    raise exception 'not_authorized';
  end if;

  v_start := to_timestamp(p_period_yyyymm || '01', 'YYYYMMDD');
  v_end := (v_start + interval '1 month');

  select count(*) into v_in
    from public.channel_messages
   where workspace_id = p_workspace_id
     and direction = 'in'
     and created_at >= v_start and created_at < v_end;

  select count(*) into v_out
    from public.channel_messages
   where workspace_id = p_workspace_id
     and direction = 'out'
     and created_at >= v_start and created_at < v_end;

  select coalesce(sum(size_bytes),0) into v_kb
    from public.knowledge_sources
   where workspace_id = p_workspace_id;

  select count(*) into v_agents from public.agents where workspace_id = p_workspace_id;
  select count(*) into v_channels from public.channels where workspace_id = p_workspace_id;
  select count(*) into v_sources from public.knowledge_sources where workspace_id = p_workspace_id;

  insert into public.usage_counters (workspace_id, period_yyyymm, messages_in, messages_out, kb_bytes, agents_count, channels_count, sources_count)
  values (p_workspace_id, p_period_yyyymm, v_in, v_out, v_kb, v_agents, v_channels, v_sources)
  on conflict (workspace_id, period_yyyymm) do update
    set messages_in = excluded.messages_in,
        messages_out = excluded.messages_out,
        kb_bytes = excluded.kb_bytes,
        agents_count = excluded.agents_count,
        channels_count = excluded.channels_count,
        sources_count = excluded.sources_count;

  select * into v_row from public.usage_counters
   where workspace_id = p_workspace_id and period_yyyymm = p_period_yyyymm;

  return v_row;
end;
$$;

commit;
