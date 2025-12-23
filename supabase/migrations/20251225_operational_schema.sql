-- Operational schema for inbox state, orders, and support tickets

-- =========================================================
-- chat_sessions updates
-- =========================================================
-- add operational columns
alter table public.chat_sessions add column if not exists status text not null default 'open';
alter table public.chat_sessions add column if not exists assigned_to uuid;
alter table public.chat_sessions add column if not exists unread_count integer not null default 0;
alter table public.chat_sessions add column if not exists last_message_at timestamptz not null default now();

-- enforce status values
alter table public.chat_sessions drop constraint if exists chat_sessions_status_check;
alter table public.chat_sessions
add constraint chat_sessions_status_check
check (status in ('open', 'resolved', 'handoff', 'archived'));

-- ensure foreign key
alter table public.chat_sessions drop constraint if exists chat_sessions_assigned_to_fkey;
alter table public.chat_sessions
add constraint chat_sessions_assigned_to_fkey
foreign key (assigned_to) references auth.users(id) on delete set null;

-- =========================================================
-- orders
-- =========================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  session_id uuid not null,
  customer_name text,
  amount integer,
  status text not null,
  items jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ensure columns exist
alter table public.orders add column if not exists workspace_id uuid;
alter table public.orders add column if not exists session_id uuid;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists amount integer;
alter table public.orders add column if not exists status text;
alter table public.orders add column if not exists items jsonb;
alter table public.orders add column if not exists created_at timestamptz;
alter table public.orders add column if not exists updated_at timestamptz;

-- defaults and constraints
alter table public.orders alter column workspace_id set not null;
alter table public.orders alter column session_id set not null;
alter table public.orders alter column status set not null;
alter table public.orders alter column created_at set default now();
alter table public.orders alter column created_at set not null;
alter table public.orders alter column updated_at set default now();
alter table public.orders alter column updated_at set not null;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
add constraint orders_status_check
check (status in ('pending', 'paid', 'shipped', 'cancelled'));

-- foreign keys
alter table public.orders drop constraint if exists orders_workspace_id_fkey;
alter table public.orders
add constraint orders_workspace_id_fkey
foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.orders drop constraint if exists orders_session_id_fkey;
alter table public.orders
add constraint orders_session_id_fkey
foreign key (session_id) references public.chat_sessions(id) on delete cascade;

-- rls
alter table public.orders enable row level security;

drop policy if exists orders_select_workspace_members on public.orders;
create policy orders_select_workspace_members
on public.orders
for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = orders.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists orders_insert_workspace_members on public.orders;
create policy orders_insert_workspace_members
on public.orders
for insert
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = orders.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists orders_update_workspace_members on public.orders;
create policy orders_update_workspace_members
on public.orders
for update
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = orders.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = orders.workspace_id
      and wm.user_id = auth.uid()
  )
);

-- prevent delete by omission of delete policy

-- =========================================================
-- tickets
-- =========================================================
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  session_id uuid not null,
  subject text,
  description text,
  priority text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ensure columns exist
alter table public.tickets add column if not exists workspace_id uuid;
alter table public.tickets add column if not exists session_id uuid;
alter table public.tickets add column if not exists subject text;
alter table public.tickets add column if not exists description text;
alter table public.tickets add column if not exists priority text;
alter table public.tickets add column if not exists status text;
alter table public.tickets add column if not exists created_at timestamptz;
alter table public.tickets add column if not exists updated_at timestamptz;

-- defaults and constraints
alter table public.tickets alter column workspace_id set not null;
alter table public.tickets alter column session_id set not null;
alter table public.tickets alter column priority set not null;
alter table public.tickets alter column status set not null;
alter table public.tickets alter column created_at set default now();
alter table public.tickets alter column created_at set not null;
alter table public.tickets alter column updated_at set default now();
alter table public.tickets alter column updated_at set not null;

alter table public.tickets drop constraint if exists tickets_priority_check;
alter table public.tickets
add constraint tickets_priority_check
check (priority in ('low', 'medium', 'high'));

alter table public.tickets drop constraint if exists tickets_status_check;
alter table public.tickets
add constraint tickets_status_check
check (status in ('new', 'in_progress', 'closed'));

-- foreign keys
alter table public.tickets drop constraint if exists tickets_workspace_id_fkey;
alter table public.tickets
add constraint tickets_workspace_id_fkey
foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.tickets drop constraint if exists tickets_session_id_fkey;
alter table public.tickets
add constraint tickets_session_id_fkey
foreign key (session_id) references public.chat_sessions(id) on delete cascade;

-- rls
alter table public.tickets enable row level security;

drop policy if exists tickets_select_workspace_members on public.tickets;
create policy tickets_select_workspace_members
on public.tickets
for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = tickets.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists tickets_insert_workspace_members on public.tickets;
create policy tickets_insert_workspace_members
on public.tickets
for insert
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = tickets.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists tickets_update_workspace_members on public.tickets;
create policy tickets_update_workspace_members
on public.tickets
for update
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = tickets.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = tickets.workspace_id
      and wm.user_id = auth.uid()
  )
);

-- triggers to keep updated_at current
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_orders_updated_at on public.orders;
create trigger update_orders_updated_at
before update on public.orders
for each row execute function public.update_updated_at_column();

drop trigger if exists update_tickets_updated_at on public.tickets;
create trigger update_tickets_updated_at
before update on public.tickets
for each row execute function public.update_updated_at_column();
