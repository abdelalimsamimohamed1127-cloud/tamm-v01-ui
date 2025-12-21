-- ZIP 7: Paymob billing + hardening (rate limiting + monitoring)

-- 1) Rate limiting table (server-side only)
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null default 0,
  updated_at timestamptz not null default now()
);

-- Do NOT enable RLS on rate_limits (only service-role edge functions should touch it).

-- 2) Billing tables
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  tier text not null,
  status text not null default 'inactive',
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  provider text not null default 'paymob',
  provider_customer_ref text null,
  provider_subscription_ref text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  subscription_id uuid null references public.subscriptions(id) on delete set null,
  amount_egp numeric not null,
  currency text not null default 'EGP',
  status text not null default 'pending',
  due_at timestamptz null,
  paid_at timestamptz null,
  provider text not null default 'paymob',
  paymob_order_id bigint null,
  paymob_transaction_id bigint null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  invoice_id uuid null references public.invoices(id) on delete set null,
  provider text not null default 'paymob',
  amount_egp numeric not null,
  currency text not null default 'EGP',
  status text not null default 'initiated',
  paymob_transaction_id bigint null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.paymob_webhook_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null,
  event_type text null,
  verified boolean not null default false,
  paymob_order_id bigint null,
  paymob_transaction_id bigint null,
  raw_payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists invoices_workspace_id_idx on public.invoices(workspace_id);
create index if not exists payments_workspace_id_idx on public.payments(workspace_id);
create index if not exists paymob_webhook_order_idx on public.paymob_webhook_events(paymob_order_id);

-- 3) RLS
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

-- Workspace members can read billing artifacts (write happens via edge service-role)
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
for select to authenticated
using (public.is_workspace_member(workspace_id));

-- Explicitly deny writes from client (no INSERT/UPDATE/DELETE policies).

-- 4) Helper: bump counts (period) for billing/ops (safe noop if exists)
-- Reuse existing monthly usage table; no change here.
