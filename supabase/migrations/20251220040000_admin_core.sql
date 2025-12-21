-- Admin core schema + strict RLS for admin tables

create extension if not exists "pgcrypto";

-- =========================================================
-- user_roles
-- =========================================================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','support','viewer')),
  created_at timestamptz not null default now()
);

alter table public.user_roles add column if not exists id uuid;
update public.user_roles set id = gen_random_uuid() where id is null;
alter table public.user_roles alter column id set not null;
alter table public.user_roles alter column id set default gen_random_uuid();
alter table public.user_roles drop constraint if exists user_roles_pkey;
alter table public.user_roles add constraint user_roles_pkey primary key (id);

alter table public.user_roles add column if not exists user_id uuid;
alter table public.user_roles alter column user_id set not null;
alter table public.user_roles drop constraint if exists user_roles_user_id_fkey;
alter table public.user_roles add constraint user_roles_user_id_fkey
foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.user_roles drop constraint if exists user_roles_user_id_key;
alter table public.user_roles add constraint user_roles_user_id_key unique (user_id);

alter table public.user_roles add column if not exists role text;
update public.user_roles set role = lower(role);
update public.user_roles
set role = 'viewer'
where role is null or role not in ('admin','support','viewer');
alter table public.user_roles alter column role set not null;
alter table public.user_roles alter column role set default 'viewer';
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
check (role in ('admin','support','viewer'));

alter table public.user_roles add column if not exists created_at timestamptz;
alter table public.user_roles alter column created_at set not null;
alter table public.user_roles alter column created_at set default now();

alter table public.user_roles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to public;

-- =========================================================
-- subscriptions
-- =========================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan text,
  status text not null check (status in ('active','trialing','past_due','canceled')),
  provider text not null default 'paymob',
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions add column if not exists plan text;
alter table public.subscriptions add column if not exists provider_subscription_id text;
alter table public.subscriptions add column if not exists current_period_start timestamptz;
alter table public.subscriptions add column if not exists current_period_end timestamptz;
alter table public.subscriptions
add column if not exists provider text;

alter table public.subscriptions
alter column provider set default 'paymob';

alter table public.subscriptions
alter column provider set not null;

alter table public.subscriptions alter column provider set not null;

update public.subscriptions
set status = 'trialing'
where status is null
   or status not in ('active','trialing','past_due','canceled');

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
check (status in ('active','trialing','past_due','canceled'));

alter table public.subscriptions alter column status set default 'trialing';
alter table public.subscriptions alter column created_at set default now();
alter table public.subscriptions alter column updated_at set default now();
alter table public.subscriptions enable row level security;

create index if not exists subscriptions_workspace_idx
on public.subscriptions(workspace_id);

create index if not exists subscriptions_provider_subscription_idx
on public.subscriptions(provider_subscription_id);

-- =========================================================
-- usage_events
-- =========================================================
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null,
  quantity integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.usage_events add column if not exists event_type text;
alter table public.usage_events alter column event_type set not null;

alter table public.usage_events add column if not exists metadata jsonb;
update public.usage_events set metadata = '{}'::jsonb where metadata is null;
alter table public.usage_events alter column metadata set not null;
alter table public.usage_events alter column metadata set default '{}'::jsonb;

alter table public.usage_events alter column quantity set default 0;
alter table public.usage_events alter column quantity set not null;

alter table public.usage_events enable row level security;

-- =========================================================
-- audit_logs
-- =========================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs add column if not exists workspace_id uuid;
alter table public.audit_logs add column if not exists target_type text;
alter table public.audit_logs add column if not exists target_id uuid;
alter table public.audit_logs add column if not exists metadata jsonb;
update public.audit_logs set metadata = '{}'::jsonb where metadata is null;
alter table public.audit_logs alter column metadata set not null;
alter table public.audit_logs alter column metadata set default '{}'::jsonb;
alter table public.audit_logs enable row level security;

create index if not exists audit_logs_workspace_created_idx
on public.audit_logs(workspace_id, created_at desc);

-- =========================================================
-- Strict RLS: admins only
-- =========================================================

-- user_roles
drop policy if exists user_roles_admin_select on public.user_roles;
drop policy if exists user_roles_admin_insert on public.user_roles;
drop policy if exists user_roles_admin_update on public.user_roles;
drop policy if exists user_roles_admin_delete on public.user_roles;

create policy user_roles_admin_select
on public.user_roles
for select
using (public.is_admin());

create policy user_roles_admin_insert
on public.user_roles
for insert
with check (public.is_admin());

create policy user_roles_admin_update
on public.user_roles
for update
using (public.is_admin())
with check (public.is_admin());

create policy user_roles_admin_delete
on public.user_roles
for delete
using (public.is_admin());

-- subscriptions
drop policy if exists subscriptions_admin_select on public.subscriptions;
drop policy if exists subscriptions_admin_mutate on public.subscriptions;

create policy subscriptions_admin_select
on public.subscriptions
for select
using (public.is_admin());

create policy subscriptions_admin_mutate
on public.subscriptions
for all
using (public.is_admin())
with check (public.is_admin());

-- usage_events
drop policy if exists usage_events_admin_select on public.usage_events;
drop policy if exists usage_events_admin_mutate on public.usage_events;

create policy usage_events_admin_select
on public.usage_events
for select
using (public.is_admin());

create policy usage_events_admin_mutate
on public.usage_events
for all
using (public.is_admin())
with check (public.is_admin());

-- audit_logs
drop policy if exists audit_logs_admin_select on public.audit_logs;
drop policy if exists audit_logs_admin_mutate on public.audit_logs;

create policy audit_logs_admin_select
on public.audit_logs
for select
using (public.is_admin());

create policy audit_logs_admin_mutate
on public.audit_logs
for all
using (public.is_admin())
with check (public.is_admin());
