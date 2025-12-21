-- ZIP2: Inbox + Drafts + Data export/delete + Plan tier
begin;

alter table if exists public.workspace_settings
  add column if not exists plan_tier text not null default 'free';

alter table if exists public.channel_messages
  add column if not exists is_draft boolean not null default false;

create index if not exists channel_messages_conversation_created_idx
  on public.channel_messages (workspace_id, conversation_id, created_at);

create table if not exists public.data_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid null references auth.users(id) on delete set null,
  type text not null check (type in ('export','delete')),
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  result jsonb null,
  error text null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

alter table public.data_requests enable row level security;

drop policy if exists "data_requests_select" on public.data_requests;
create policy "data_requests_select"
on public.data_requests for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "data_requests_insert" on public.data_requests;
create policy "data_requests_insert"
on public.data_requests for insert
to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "data_requests_update" on public.data_requests;
create policy "data_requests_update"
on public.data_requests for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

commit;
