-- Admin RBAC + billing/usage/audit tables for Tamm (MVP)
-- Safe to re-run (IF NOT EXISTS / OR REPLACE)

create extension if not exists pgcrypto;

-- Roles table: assign admins/support/finance etc.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin','support','finance')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  );
$$;

-- Usage events: record cost drivers (messages, embeddings, ingest bytes, tokens estimate)
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  event_type text not null,
  quantity numeric not null default 0,
  unit text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;

-- Subscriptions (stripe later): track who paid / status
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null default 'stripe',
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled')),
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Audit logs: track sensitive actions (retrain, delete source, billing changes)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- Policies: user_roles
drop policy if exists user_roles_read on public.user_roles;
create policy user_roles_read
on public.user_roles
for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_roles_write_admin on public.user_roles;
create policy user_roles_write_admin
on public.user_roles
for all
using (public.is_admin())
with check (public.is_admin());

-- Policies: usage_events
drop policy if exists usage_events_select on public.usage_events;
create policy usage_events_select
on public.usage_events
for select
using (public.is_admin() or public.is_workspace_member(workspace_id));

drop policy if exists usage_events_insert on public.usage_events;
create policy usage_events_insert
on public.usage_events
for insert
with check (public.is_admin() or public.is_workspace_member(workspace_id));

-- Admin write policies for usage_events
drop policy if exists usage_events_admin_write on public.usage_events; -- legacy name
drop policy if exists usage_events_admin_update on public.usage_events;
create policy usage_events_admin_update
on public.usage_events
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists usage_events_admin_delete on public.usage_events;
create policy usage_events_admin_delete
on public.usage_events
for delete
using (public.is_admin());

-- Policies: subscriptions
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select
on public.subscriptions
for select
using (public.is_admin() or public.is_workspace_member(workspace_id));

drop policy if exists subscriptions_admin_write on public.subscriptions;
create policy subscriptions_admin_write
on public.subscriptions
for all
using (public.is_admin())
with check (public.is_admin());
drop policy if exists subscriptions_admin_write on public.subscriptions;
alter table public.audit_logs
add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

-- Policies: audit_logs
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select
on public.audit_logs
for select
using (public.is_admin());

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert
on public.audit_logs
for insert
with check (actor_user_id = auth.uid() and public.is_workspace_member(workspace_id));

-- Helpful indexes
create index if not exists usage_events_workspace_created_idx on public.usage_events (workspace_id, created_at desc);
create index if not exists audit_logs_workspace_created_idx on public.audit_logs (workspace_id, created_at desc);
create index if not exists subscriptions_workspace_idx on public.subscriptions (workspace_id);
