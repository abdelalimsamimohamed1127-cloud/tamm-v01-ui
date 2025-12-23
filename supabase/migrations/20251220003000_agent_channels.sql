
create table if not exists public.agent_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  platform text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, platform)
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agent_channels'
      and column_name = 'channel'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agent_channels'
      and column_name = 'platform'
  ) then
    alter table public.agent_channels rename column channel to platform;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agent_channels'
      and column_name = 'is_enabled'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agent_channels'
      and column_name = 'is_active'
  ) then
    alter table public.agent_channels rename column is_enabled to is_active;
  end if;
end $$;

comment on column public.agent_channels.config is 'Non-secret channel configuration. Do not store secrets here.';

alter table if exists public.agent_channels
  drop constraint if exists agent_channels_workspace_id_fkey;

alter table if exists public.agent_channels
  add constraint agent_channels_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table if exists public.agent_channels
  drop constraint if exists agent_channels_agent_id_fkey;

alter table if exists public.agent_channels
  add constraint agent_channels_agent_id_fkey
  foreign key (agent_id) references public.agents(id) on delete cascade;

alter table if exists public.agent_channels
  drop constraint if exists agent_channels_agent_id_channel_key;

alter table if exists public.agent_channels
  drop constraint if exists agent_channels_agent_id_platform_key;

alter table if exists public.agent_channels
  add constraint agent_channels_agent_id_platform_key unique (agent_id, platform);

alter table if exists public.agent_channels
  drop constraint if exists agent_channels_platform_check;

alter table if exists public.agent_channels
  add constraint agent_channels_platform_check check (platform in ('webchat', 'whatsapp', 'messenger', 'email'));

alter table if exists public.agent_channels
  alter column platform set not null,
  alter column config set not null,
  alter column config set default '{}'::jsonb,
  alter column is_active set not null,
  alter column is_active set default false,
  alter column created_at set default now(),
  alter column updated_at set default now();

create index if not exists agent_channels_workspace_idx
  on public.agent_channels (workspace_id);

create index if not exists agent_channels_agent_idx
  on public.agent_channels (agent_id);

alter table if exists public.agent_channels enable row level security;

drop policy if exists "view_agent_channels" on public.agent_channels;
create policy "view_agent_channels"
  on public.agent_channels
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_channels.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "manage_agent_channels" on public.agent_channels;
create policy "manage_agent_channels"
  on public.agent_channels
  for all
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_channels.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_channels.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

drop trigger if exists update_agent_channels_updated_at on public.agent_channels;
create trigger update_agent_channels_updated_at
  before update on public.agent_channels
  for each row
  execute function public.update_updated_at_column();
