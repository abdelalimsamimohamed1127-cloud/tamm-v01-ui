-- Agent Knowledge contract (sources + chunks) with workspace-scoped RLS

-- Ensure required extensions
create extension if not exists "vector";

-- Ensure updated_at helper exists
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create or replace function public.set_updated_at()
    returns trigger as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$ language plpgsql;
  end if;
end $$;

-- Agent knowledge sources
create table if not exists public.agent_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  agent_id uuid not null references public.agents(id),
  type text not null,
  title text not null,
  status text not null default 'uploaded',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists trg_agent_knowledge_sources_updated_at on public.agent_knowledge_sources;
create trigger trg_agent_knowledge_sources_updated_at
before update on public.agent_knowledge_sources
for each row execute function public.set_updated_at();

-- Agent knowledge chunks
create table if not exists public.agent_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  agent_id uuid not null references public.agents(id),
  source_id uuid not null references public.agent_knowledge_sources(id),
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- RLS
alter table public.agent_knowledge_sources enable row level security;
alter table public.agent_knowledge_chunks enable row level security;

-- Policies: require workspace membership for all actions
drop policy if exists agent_knowledge_sources_select on public.agent_knowledge_sources;
create policy agent_knowledge_sources_select
on public.agent_knowledge_sources
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists agent_knowledge_sources_write on public.agent_knowledge_sources;
create policy agent_knowledge_sources_write
on public.agent_knowledge_sources
for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists agent_knowledge_chunks_select on public.agent_knowledge_chunks;
create policy agent_knowledge_chunks_select
on public.agent_knowledge_chunks
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists agent_knowledge_chunks_write on public.agent_knowledge_chunks;
create policy agent_knowledge_chunks_write
on public.agent_knowledge_chunks
for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

-- Indexes for workspace-scoped lookups
create index if not exists agent_knowledge_sources_workspace_agent_idx
  on public.agent_knowledge_sources (workspace_id, agent_id, created_at desc);

create index if not exists agent_knowledge_chunks_source_idx
  on public.agent_knowledge_chunks (source_id, created_at);
