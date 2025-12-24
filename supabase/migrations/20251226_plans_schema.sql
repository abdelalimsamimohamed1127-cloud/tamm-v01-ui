-- SaaS plans and workspace subscriptions
-- Safe to re-run

create extension if not exists pgcrypto;

-- =========================================================
-- plans
-- =========================================================
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_monthly integer not null,
  monthly_credits integer not null,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  paymob_plan_id text,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

drop policy if exists plans_select_public on public.plans;
drop policy if exists plans_admin_write on public.plans;
drop policy if exists plans_admin_insert on public.plans;
drop policy if exists plans_admin_update on public.plans;
drop policy if exists plans_admin_delete on public.plans;

create policy plans_select_public
on public.plans
for select
using (true);

create policy plans_admin_insert
on public.plans
for insert
with check (public.is_admin());

create policy plans_admin_update
on public.plans
for update
using (public.is_admin())
with check (public.is_admin());

create policy plans_admin_delete
on public.plans
for delete
using (public.is_admin());

-- Seed default plans
insert into public.plans (name, price_monthly, monthly_credits, features)
select 'Free', 0, 50, '{"agents": 1, "upload_limit": 5}'::jsonb
where not exists (
  select 1 from public.plans p where p.name = 'Free'
);

insert into public.plans (name, price_monthly, monthly_credits, features)
select 'Pro', 2900, 5000, '{"agents": 5, "upload_limit": 100}'::jsonb
where not exists (
  select 1 from public.plans p where p.name = 'Pro'
);

-- =========================================================
-- subscriptions
-- =========================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid references public.plans(id),
  status text not null default 'trialing' check (status in ('active','past_due','canceled','trialing')),
  current_period_end timestamptz,
  paymob_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure required columns exist
alter table public.subscriptions add column if not exists plan_id uuid;
alter table public.subscriptions add column if not exists current_period_end timestamptz;
alter table public.subscriptions add column if not exists paymob_subscription_id text;
alter table public.subscriptions add column if not exists created_at timestamptz not null default now();
alter table public.subscriptions add column if not exists updated_at timestamptz not null default now();

-- Align status constraint
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
check (status in ('active','past_due','canceled','trialing'));

alter table public.subscriptions alter column status set not null;
alter table public.subscriptions alter column status set default 'trialing';

-- Workspace uniqueness
DO $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.subscriptions'::regclass
      and conname = 'subscriptions_workspace_id_key'
  ) then
    alter table public.subscriptions
    add constraint subscriptions_workspace_id_key unique (workspace_id);
  end if;
end $$;

-- Foreign key for plan_id
DO $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.subscriptions'::regclass
      and conname = 'subscriptions_plan_id_fkey'
  ) then
    alter table public.subscriptions
    add constraint subscriptions_plan_id_fkey foreign key (plan_id)
      references public.plans(id);
  end if;
end $$;

-- Backfill plan_id to Free for existing rows
update public.subscriptions s
set plan_id = p.id
from public.plans p
where p.name = 'Free'
  and s.plan_id is null;

alter table public.subscriptions alter column plan_id set not null;
alter table public.subscriptions alter column workspace_id set not null;

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select on public.subscriptions;
drop policy if exists subscriptions_admin_write on public.subscriptions;
drop policy if exists subscriptions_admin_select on public.subscriptions;
drop policy if exists subscriptions_admin_mutate on public.subscriptions;
drop policy if exists "subscriptions_admin_only" on public.subscriptions;

drop policy if exists subscriptions_insert on public.subscriptions;
drop policy if exists subscriptions_update on public.subscriptions;
drop policy if exists subscriptions_delete on public.subscriptions;

drop policy if exists subscriptions_member_select on public.subscriptions;

create policy subscriptions_member_select
on public.subscriptions
for select
using (public.is_workspace_member(workspace_id));

-- No insert/update/delete policies to enforce backend-only mutations
