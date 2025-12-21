-- Knowledge Base jobs (retrain, ingest batches) - MVP tracking
create table if not exists public.kb_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  kind text not null check (kind in ('retrain')),
  status text not null default 'queued' check (status in ('queued','processing','done','failed')),
  total_sources integer not null default 0,
  processed_sources integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kb_jobs enable row level security;

drop policy if exists kb_jobs_select on public.kb_jobs;
create policy kb_jobs_select
on public.kb_jobs
for select
using (public.is_admin() or public.is_workspace_member(workspace_id));

drop policy if exists kb_jobs_insert on public.kb_jobs;
create policy kb_jobs_insert
on public.kb_jobs
for insert
with check (public.is_admin() or public.is_workspace_member(workspace_id));

drop policy if exists kb_jobs_update_admin on public.kb_jobs;
create policy kb_jobs_update_admin
on public.kb_jobs
for update, delete
using (public.is_admin())
with check (public.is_admin());

create index if not exists kb_jobs_workspace_created_idx on public.kb_jobs (workspace_id, created_at desc);
