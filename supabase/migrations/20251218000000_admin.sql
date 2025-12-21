-- Admin RBAC + billing/usage/audit tables for Tamm
-- Apply with Supabase SQL editor or `supabase db push` if using Supabase CLI.

create extension if not exists pgcrypto;

-- ================
-- user_roles
-- ================
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- ================
-- Helpers (RBAC)
-- ================
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and lower(ur.role) in ('admin','owner')
  );
$$;


-- Policies for user_roles
drop policy if exists "user_roles_read_own" on public.user_roles;
create policy "user_roles_read_own"
on public.user_roles
for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_roles_write_admin" on public.user_roles;
create policy "user_roles_write_admin"
on public.user_roles
for all
using (public.is_admin())
with check (public.is_admin());

-- ================
-- subscriptions (Stripe sync)
-- ================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'unknown',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_admin_only" on public.subscriptions;
create policy "subscriptions_admin_only"
on public.subscriptions
for all
using (public.is_admin())
with check (public.is_admin());

-- ================
-- usage_events (cost control)
-- ================
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  type text not null,
  quantity numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;

drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own"
on public.usage_events
for select
using (public.is_admin() or public.is_workspace_member(workspace_id));

drop policy if exists "usage_events_insert_own" on public.usage_events;
create policy "usage_events_insert_own"
on public.usage_events
for insert
with check (public.is_admin() or public.is_workspace_member(workspace_id));

-- ================
-- audit_logs
-- ================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_admin_only" on public.audit_logs;
create policy "audit_logs_admin_only"
on public.audit_logs
for all
using (public.is_admin())
with check (public.is_admin());
