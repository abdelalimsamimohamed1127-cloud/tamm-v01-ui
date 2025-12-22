-- Foundational AI Agents contract
-- Creates/aligns the agents table and enforces workspace-scoped access

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null,
  role text not null,
  tone text not null,
  language text not null,
  system_prompt text not null,
  rules jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure required columns exist (additive only)
alter table public.agents
  add column if not exists workspace_id uuid,
  add column if not exists name text,
  add column if not exists role text,
  add column if not exists tone text,
  add column if not exists language text,
  add column if not exists system_prompt text,
  add column if not exists rules jsonb default '{}'::jsonb,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Backfill required values for existing rows
update public.agents set role = 'assistant' where role is null;
update public.agents set tone = 'neutral' where tone is null;
update public.agents set language = 'en' where language is null;
update public.agents set system_prompt = '' where system_prompt is null;
update public.agents set is_active = true where is_active is null;

-- Safely migrate legacy rules_jsonb (if exists) into rules (jsonb only)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agents'
      and column_name = 'rules_jsonb'
  ) then
    update public.agents
    set rules = rules_jsonb
    where rules is null;
  else
    update public.agents
    set rules = '{}'::jsonb
    where rules is null;
  end if;
end $$;



-- Enforce contract constraints
alter table public.agents
  alter column workspace_id set not null,
  alter column name set not null,
  alter column role set not null,
  alter column tone set not null,
  alter column language set not null,
  alter column system_prompt set not null,
  alter column rules set default '{}'::jsonb,
  alter column is_active set default true,
  alter column created_at set default now(),
  alter column updated_at set default now();

-- Workspace relationship
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agents_workspace_id_fkey'
  ) then
    alter table public.agents
      add constraint agents_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id);
  end if;
end $$;

create unique index if not exists agents_workspace_unique_idx
on public.agents (workspace_id);

-- updated_at trigger helper
do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pg_function_is_visible(oid)
  ) then
    create function public.set_updated_at()
    returns trigger as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$ language plpgsql;
  end if;
end $$;

drop trigger if exists trg_agents_set_updated_at on public.agents;
create trigger trg_agents_set_updated_at
before update on public.agents
for each row
execute function public.set_updated_at();

-- Row Level Security
alter table public.agents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agents'
      and policyname = 'Agents select by workspace'
  ) then
    create policy "Agents select by workspace"
      on public.agents
      for select
      using (is_workspace_member(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agents'
      and policyname = 'Agents insert by workspace'
  ) then
    create policy "Agents insert by workspace"
      on public.agents
      for insert
      with check (is_workspace_member(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agents'
      and policyname = 'Agents update by workspace'
  ) then
    create policy "Agents update by workspace"
      on public.agents
      for update
      using (is_workspace_member(workspace_id))
      with check (is_workspace_member(workspace_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'agents'
      and policyname = 'Agents delete by workspace'
  ) then
    create policy "Agents delete by workspace"
      on public.agents
      for delete
      using (is_workspace_member(workspace_id));
  end if;
end $$;
