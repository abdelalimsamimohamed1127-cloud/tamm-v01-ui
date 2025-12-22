-- Runtime Messaging Loop (Webchat) contract

-- =========================================================
-- chat_sessions
-- =========================================================
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id uuid not null,
  channel text not null,
  visitor_id text not null,
  created_at timestamptz default now(),
  last_message_at timestamptz default now()
);

alter table public.chat_sessions add column if not exists workspace_id uuid not null;
alter table public.chat_sessions add column if not exists agent_id uuid not null;
alter table public.chat_sessions add column if not exists channel text not null;
alter table public.chat_sessions add column if not exists visitor_id text not null;
alter table public.chat_sessions add column if not exists created_at timestamptz default now();
alter table public.chat_sessions add column if not exists last_message_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_sessions_workspace_id_fkey'
      and conrelid = 'public.chat_sessions'::regclass
  ) then
    alter table public.chat_sessions
    add constraint chat_sessions_workspace_id_fkey
    foreign key (workspace_id) references public.workspaces(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_sessions_agent_id_fkey'
      and conrelid = 'public.chat_sessions'::regclass
  ) then
    alter table public.chat_sessions
    add constraint chat_sessions_agent_id_fkey
    foreign key (agent_id) references public.agents(id);
  end if;
end $$;

alter table public.chat_sessions enable row level security;

drop policy if exists chat_sessions_select on public.chat_sessions;
create policy chat_sessions_select
on public.chat_sessions
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists chat_sessions_insert on public.chat_sessions;
create policy chat_sessions_insert
on public.chat_sessions
for insert
with check (public.is_workspace_member(workspace_id));

drop policy if exists chat_sessions_update on public.chat_sessions;
create policy chat_sessions_update
on public.chat_sessions
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists chat_sessions_delete on public.chat_sessions;
create policy chat_sessions_delete
on public.chat_sessions
for delete
using (public.is_workspace_member(workspace_id));

-- =========================================================
-- chat_messages
-- =========================================================
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id uuid not null,
  session_id uuid not null,
  sender text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.chat_messages add column if not exists workspace_id uuid not null;
alter table public.chat_messages add column if not exists agent_id uuid not null;
alter table public.chat_messages add column if not exists session_id uuid not null;
alter table public.chat_messages add column if not exists sender text not null;
alter table public.chat_messages add column if not exists content text not null;
alter table public.chat_messages add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_workspace_id_fkey'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
    add constraint chat_messages_workspace_id_fkey
    foreign key (workspace_id) references public.workspaces(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_agent_id_fkey'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
    add constraint chat_messages_agent_id_fkey
    foreign key (agent_id) references public.agents(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_session_id_fkey'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
    add constraint chat_messages_session_id_fkey
    foreign key (session_id) references public.chat_sessions(id);
  end if;
end $$;

alter table public.chat_messages enable row level security;

drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select
on public.chat_messages
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert
on public.chat_messages
for insert
with check (public.is_workspace_member(workspace_id));

drop policy if exists chat_messages_update on public.chat_messages;
create policy chat_messages_update
on public.chat_messages
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists chat_messages_delete on public.chat_messages;
create policy chat_messages_delete
on public.chat_messages
for delete
using (public.is_workspace_member(workspace_id));

-- =========================================================
-- usage_events
-- =========================================================
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id uuid not null,
  event_type text not null,
  units integer not null default 1,
  created_at timestamptz default now()
);

alter table public.usage_events add column if not exists workspace_id uuid not null;
alter table public.usage_events add column if not exists agent_id uuid;
alter table public.usage_events add column if not exists event_type text not null;
alter table public.usage_events add column if not exists units integer default 1;
alter table public.usage_events add column if not exists created_at timestamptz default now();

-- Align existing data to new constraints
update public.usage_events
set units = coalesce(units, 1)
where units is null;

alter table public.usage_events alter column units set default 1;
alter table public.usage_events alter column units set not null;

alter table public.usage_events alter column agent_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'usage_events_workspace_id_fkey'
      and conrelid = 'public.usage_events'::regclass
  ) then
    alter table public.usage_events
    add constraint usage_events_workspace_id_fkey
    foreign key (workspace_id) references public.workspaces(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'usage_events_agent_id_fkey'
      and conrelid = 'public.usage_events'::regclass
  ) then
    alter table public.usage_events
    add constraint usage_events_agent_id_fkey
    foreign key (agent_id) references public.agents(id);
  end if;
end $$;

alter table public.usage_events enable row level security;

drop policy if exists usage_events_select on public.usage_events;
create policy usage_events_select
on public.usage_events
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists usage_events_insert on public.usage_events;
create policy usage_events_insert
on public.usage_events
for insert
with check (public.is_workspace_member(workspace_id));

drop policy if exists usage_events_update on public.usage_events;
create policy usage_events_update
on public.usage_events
for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists usage_events_delete on public.usage_events;
create policy usage_events_delete
on public.usage_events
for delete
using (public.is_workspace_member(workspace_id));
