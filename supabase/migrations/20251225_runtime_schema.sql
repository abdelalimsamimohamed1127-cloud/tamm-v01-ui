-- Runtime schema for chat sessions, messages, and usage events

-- =========================================================
-- chat_sessions
-- =========================================================
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id uuid not null,
  user_id uuid,
  external_user_id text,
  channel text not null,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_sessions add column if not exists workspace_id uuid;
alter table public.chat_sessions add column if not exists agent_id uuid;
alter table public.chat_sessions add column if not exists user_id uuid;
alter table public.chat_sessions add column if not exists external_user_id text;
alter table public.chat_sessions add column if not exists channel text;
alter table public.chat_sessions add column if not exists summary text;
alter table public.chat_sessions add column if not exists created_at timestamptz;
alter table public.chat_sessions add column if not exists updated_at timestamptz;

alter table public.chat_sessions alter column workspace_id set not null;
alter table public.chat_sessions alter column agent_id set not null;
alter table public.chat_sessions alter column channel set not null;
alter table public.chat_sessions alter column created_at set default now();
alter table public.chat_sessions alter column created_at set not null;
alter table public.chat_sessions alter column updated_at set default now();
alter table public.chat_sessions alter column updated_at set not null;

alter table public.chat_sessions drop column if exists visitor_id;
alter table public.chat_sessions drop column if exists last_message_at;

alter table public.chat_sessions drop constraint if exists chat_sessions_channel_check;
alter table public.chat_sessions
add constraint chat_sessions_channel_check
check (channel in ('webchat', 'whatsapp', 'messenger'));

alter table public.chat_sessions drop constraint if exists chat_sessions_workspace_id_fkey;
alter table public.chat_sessions
add constraint chat_sessions_workspace_id_fkey
foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.chat_sessions drop constraint if exists chat_sessions_agent_id_fkey;
alter table public.chat_sessions
add constraint chat_sessions_agent_id_fkey
foreign key (agent_id) references public.agents(id) on delete cascade;

alter table public.chat_sessions drop constraint if exists chat_sessions_user_id_fkey;
alter table public.chat_sessions
add constraint chat_sessions_user_id_fkey
foreign key (user_id) references auth.users(id) on delete set null;

alter table public.chat_sessions enable row level security;

drop policy if exists chat_sessions_select_self_or_service on public.chat_sessions;
create policy chat_sessions_select_self_or_service
on public.chat_sessions
for select
using (user_id = auth.uid() or auth.role() = 'service_role');

drop policy if exists chat_sessions_insert_service_role on public.chat_sessions;
create policy chat_sessions_insert_service_role
on public.chat_sessions
for insert
with check (auth.role() = 'service_role');

drop policy if exists chat_sessions_update_service_role on public.chat_sessions;
create policy chat_sessions_update_service_role
on public.chat_sessions
for update
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists chat_sessions_delete_service_role on public.chat_sessions;
create policy chat_sessions_delete_service_role
on public.chat_sessions
for delete
using (auth.role() = 'service_role');

drop trigger if exists update_chat_sessions_updated_at on public.chat_sessions;
create trigger update_chat_sessions_updated_at
before update on public.chat_sessions
for each row execute function public.update_updated_at_column();

-- =========================================================
-- chat_messages
-- =========================================================
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  role text not null,
  content text not null,
  token_count integer,
  created_at timestamptz not null default now()
);

alter table public.chat_messages add column if not exists session_id uuid;
alter table public.chat_messages add column if not exists role text;
alter table public.chat_messages add column if not exists content text;
alter table public.chat_messages add column if not exists token_count integer;
alter table public.chat_messages add column if not exists created_at timestamptz;

alter table public.chat_messages alter column session_id set not null;
alter table public.chat_messages alter column role set not null;
alter table public.chat_messages alter column content set not null;
alter table public.chat_messages alter column created_at set default now();
alter table public.chat_messages alter column created_at set not null;

alter table public.chat_messages add column if not exists workspace_id uuid;
alter table public.chat_messages drop column if exists agent_id;
alter table public.chat_messages drop column if exists sender;

alter table public.chat_messages drop constraint if exists chat_messages_role_check;
alter table public.chat_messages
add constraint chat_messages_role_check
check (role in ('user', 'assistant', 'system'));

alter table public.chat_messages drop constraint if exists chat_messages_session_id_fkey;
alter table public.chat_messages
add constraint chat_messages_session_id_fkey
foreign key (session_id) references public.chat_sessions(id) on delete cascade;

alter table public.chat_messages enable row level security;

drop policy if exists chat_messages_select_session_members on public.chat_messages;
create policy chat_messages_select_session_members
on public.chat_messages
for select
using (
  exists (
    select 1 from public.chat_sessions s
    where s.id = chat_messages.session_id
      and (s.user_id = auth.uid() or auth.role() = 'service_role')
  )
);

drop policy if exists chat_messages_insert_service_role on public.chat_messages;
create policy chat_messages_insert_service_role
on public.chat_messages
for insert
with check (auth.role() = 'service_role');

-- =========================================================
-- usage_events
-- =========================================================
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id uuid not null,
  event_type text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric,
  created_at timestamptz not null default now()
);

alter table public.usage_events add column if not exists workspace_id uuid;
alter table public.usage_events add column if not exists agent_id uuid;
alter table public.usage_events add column if not exists event_type text;
alter table public.usage_events add column if not exists model text;
alter table public.usage_events add column if not exists input_tokens integer;
alter table public.usage_events add column if not exists output_tokens integer;
alter table public.usage_events add column if not exists cost_usd numeric;
alter table public.usage_events add column if not exists created_at timestamptz;

alter table public.usage_events alter column workspace_id set not null;
alter table public.usage_events alter column agent_id set not null;
alter table public.usage_events alter column event_type set not null;
alter table public.usage_events alter column created_at set default now();
alter table public.usage_events alter column created_at set not null;

alter table public.usage_events drop column if exists units;

alter table public.usage_events drop constraint if exists usage_events_event_type_check;
alter table public.usage_events
add constraint usage_events_event_type_check
check (event_type in ('model_inference', 'vector_search', 'db_storage'));

alter table public.usage_events drop constraint if exists usage_events_workspace_id_fkey;
alter table public.usage_events
add constraint usage_events_workspace_id_fkey
foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.usage_events drop constraint if exists usage_events_agent_id_fkey;
alter table public.usage_events
add constraint usage_events_agent_id_fkey
foreign key (agent_id) references public.agents(id) on delete cascade;

alter table public.usage_events enable row level security;

drop policy if exists usage_events_select_admin_or_member on public.usage_events;
create policy usage_events_select_admin_or_member
on public.usage_events
for select
using (public.is_admin() or public.is_workspace_member(workspace_id));

drop policy if exists usage_events_insert_service_role on public.usage_events;
create policy usage_events_insert_service_role
on public.usage_events
for insert
with check (auth.role() = 'service_role');

drop policy if exists usage_events_update on public.usage_events;
drop policy if exists usage_events_delete on public.usage_events;
drop policy if exists usage_events_admin_update on public.usage_events;
drop policy if exists usage_events_admin_delete on public.usage_events;

create or replace function public.prevent_usage_events_mutation()
returns trigger
language plpgsql
security definer
as $$
begin
  raise exception 'usage_events is append-only';
end;
$$;

drop trigger if exists prevent_usage_events_mutation on public.usage_events;
create trigger prevent_usage_events_mutation
before update or delete on public.usage_events
for each row execute function public.prevent_usage_events_mutation();
