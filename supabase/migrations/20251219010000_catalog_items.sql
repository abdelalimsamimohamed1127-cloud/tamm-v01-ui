-- Catalog Items (product catalog rows) + allow knowledge_sources.type = 'catalog'

create extension if not exists pgcrypto;

-- 1) Extend knowledge_sources type check (keep compatible with older migrations)
alter table if exists public.knowledge_sources
  drop constraint if exists knowledge_sources_type_check;

alter table if exists public.knowledge_sources
  add constraint knowledge_sources_type_check
  check (type in ('file','text','url','qa','catalog'));

-- 2) Table to store catalog rows
create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid null references public.agents(id) on delete cascade,
  row jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_items_workspace_agent_idx
  on public.catalog_items (workspace_id, agent_id);

alter table public.catalog_items enable row level security;

-- Policies: members of the workspace can manage catalog items
drop policy if exists "Members can view catalog_items" on public.catalog_items;
create policy "Members can view catalog_items"
  on public.catalog_items
  for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can manage catalog_items" on public.catalog_items;
create policy "Members can manage catalog_items"
  on public.catalog_items
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Keep updated_at fresh
drop trigger if exists update_catalog_items_updated_at on public.catalog_items;
create trigger update_catalog_items_updated_at
  before update on public.catalog_items
  for each row execute function public.update_updated_at_column();
