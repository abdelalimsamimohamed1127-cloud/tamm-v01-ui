-- Credit Transaction Framework (CTF) core ledger schema

-- 1) workspace_wallets
create table if not exists public.workspace_wallets (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  balance bigint not null default 0,
  currency text not null default 'CREDITS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_wallets_balance_non_negative check (balance >= 0)
);

-- 2) credit_transactions
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  amount bigint not null,
  type text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint credit_transactions_type_check check (type in ('topup', 'usage', 'bonus', 'refund'))
);

create index if not exists credit_transactions_workspace_id_idx
  on public.credit_transactions (workspace_id);

-- 3) Row Level Security
alter table if exists public.workspace_wallets enable row level security;
alter table if exists public.credit_transactions enable row level security;

drop policy if exists workspace_wallets_select on public.workspace_wallets;
create policy workspace_wallets_select
  on public.workspace_wallets
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_wallets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists credit_transactions_select on public.credit_transactions;
create policy credit_transactions_select
  on public.credit_transactions
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = credit_transactions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- 4) Functions — Atomic Credit Logic
create or replace function public.deduct_credits(
  ws_id uuid,
  amount bigint,
  reason text,
  meta jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance bigint;
begin
  select balance into current_balance
  from public.workspace_wallets
  where workspace_id = ws_id
  for update;

  if current_balance is null then
    raise exception 'Wallet not found for workspace %', ws_id;
  end if;

  if current_balance < amount then
    raise exception 'Insufficient funds';
  end if;

  update public.workspace_wallets
  set balance = balance - amount,
      updated_at = now()
  where workspace_id = ws_id;

  insert into public.credit_transactions
    (workspace_id, amount, type, description, metadata)
  values
    (ws_id, -amount, 'usage', reason, meta);

  return true;
end;
$$;

create or replace function public.grant_credits(
  ws_id uuid,
  amount bigint,
  reason text,
  meta jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance bigint;
begin
  update public.workspace_wallets
  set balance = balance + amount,
      updated_at = now()
  where workspace_id = ws_id
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'Wallet not found for workspace %', ws_id;
  end if;

  insert into public.credit_transactions
    (workspace_id, amount, type, description, metadata)
  values
    (ws_id, amount, 'topup', reason, meta);

  return new_balance;
end;
$$;

-- 5) Trigger — Initial Wallet
create or replace function public.create_workspace_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_wallets (workspace_id, balance)
  values (new.id, 50)
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_workspace_wallet_trigger on public.workspaces;
create trigger create_workspace_wallet_trigger
  after insert on public.workspaces
  for each row
  execute function public.create_workspace_wallet();
