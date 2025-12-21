-- Core agent + sources + embeddings tables for RAG
-- Requires: create extension if not exists vector;

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null,
  model text not null default 'gpt-4o',
  temperature float not null default 0.2,
  system_prompt text,
  trained boolean default false,
  trained_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_agents_updated_at on agents;
create trigger trg_agents_updated_at
before update on agents
for each row execute function set_updated_at();

create table if not exists agent_sources (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade,
  type text check (type in ('files','text','website','qa')) not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists agent_embeddings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade,
  source_id uuid references agent_sources(id) on delete cascade,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz default now()
);