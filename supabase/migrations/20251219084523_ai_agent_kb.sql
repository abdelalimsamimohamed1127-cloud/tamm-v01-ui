-- AI Agent + Knowledge Base schema (minimal)
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null default 'My Agent',
  role text,
  tone text,
  language text default 'ar',
  rules text,
  llm_chat_model text default 'gpt-4o-mini',
  llm_temperature numeric default 0.2,
  rag_top_k int default 5,
  last_trained_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id uuid not null references public.agents(id) on delete cascade,
  type text not null check (type in ('file','text','website','qa','catalog')),
  title text,
  status text not null default 'pending' check (status in ('pending','processing','ready','failed')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id uuid not null references public.agents(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','done','failed')),
  total_sources int not null default 0,
  processed_sources int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

drop trigger if exists trg_kb_sources_updated_at on public.kb_sources;
create trigger trg_kb_sources_updated_at
before update on public.kb_sources
for each row execute function public.set_updated_at();

drop trigger if exists trg_kb_jobs_updated_at on public.kb_jobs;
create trigger trg_kb_jobs_updated_at
before update on public.kb_jobs
for each row execute function public.set_updated_at();

-- RLS
alter table public.agents enable row level security;
alter table public.kb_sources enable row level security;
alter table public.kb_jobs enable row level security;

-- Policies depend on is_workspace_member(workspace_id)
drop policy if exists "agents_select" on public.agents;
create policy "agents_select" on public.agents for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "agents_write" on public.agents;
create policy "agents_write" on public.agents for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "kb_sources_select" on public.kb_sources;
create policy "kb_sources_select" on public.kb_sources for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "kb_sources_write" on public.kb_sources;
create policy "kb_sources_write" on public.kb_sources for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "kb_jobs_select" on public.kb_jobs;
create policy "kb_jobs_select" on public.kb_jobs for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "kb_jobs_write" on public.kb_jobs;
create policy "kb_jobs_write" on public.kb_jobs for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
