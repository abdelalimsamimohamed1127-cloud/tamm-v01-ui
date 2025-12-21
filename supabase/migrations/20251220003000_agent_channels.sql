-- Agent channels table and RLS for workspace-scoped access

create table if not exists public.agent_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  agent_id uuid not null references public.agents(id),
  channel text not null,
  is_enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, channel)
);

create index if not exists agent_channels_workspace_idx
  on public.agent_channels (workspace_id);

create index if not exists agent_channels_agent_idx
  on public.agent_channels (agent_id);

alter table if exists public.agent_channels enable row level security;

drop policy if exists "Workspace members access agent_channels" on public.agent_channels;
create policy "Workspace members access agent_channels"
  on public.agent_channels
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop trigger if exists update_agent_channels_updated_at on public.agent_channels;
create trigger update_agent_channels_updated_at
  before update on public.agent_channels
  for each row
  execute function public.update_updated_at_column();
