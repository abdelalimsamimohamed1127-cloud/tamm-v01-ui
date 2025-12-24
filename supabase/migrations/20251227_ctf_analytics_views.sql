-- Credit Transaction Framework (CTF) analytics views

begin;

-- Ensure credit_transactions includes agent linkage for analytics
alter table if exists public.credit_transactions
  add column if not exists agent_id uuid references public.agents(id) on delete set null;

-- View 1 — Usage per Agent
drop view if exists public.agent_usage_stats;
create view public.agent_usage_stats as
select
  ct.workspace_id,
  ct.agent_id,
  a.name as agent_name,
  count(*) filter (where ct.type = 'usage') as usage_events,
  abs(sum(ct.amount)) as credits_used,
  min(ct.created_at) as first_usage_at,
  max(ct.created_at) as last_usage_at
from public.credit_transactions ct
join public.agents a on a.id = ct.agent_id
join public.workspace_members wm
  on wm.workspace_id = ct.workspace_id
 and wm.user_id = auth.uid()
where ct.amount < 0
group by ct.workspace_id, ct.agent_id, a.name;

-- View 2 — Usage per Channel
drop view if exists public.channel_usage_stats;
create view public.channel_usage_stats as
select
  ct.workspace_id,
  ac.platform as channel,
  count(*) as events_count,
  abs(sum(ct.amount)) as credits_used
from public.credit_transactions ct
join public.agent_channels ac on ac.agent_id = ct.agent_id
join public.workspace_members wm
  on wm.workspace_id = ct.workspace_id
 and wm.user_id = auth.uid()
where ct.amount < 0
group by ct.workspace_id, ac.platform;

-- View 3 — Daily Credit Burn
drop view if exists public.daily_credit_burn;
create view public.daily_credit_burn as
select
  ct.workspace_id,
  date(ct.created_at) as day,
  abs(sum(ct.amount)) as credits_used
from public.credit_transactions ct
join public.workspace_members wm
  on wm.workspace_id = ct.workspace_id
 and wm.user_id = auth.uid()
where ct.amount < 0
group by ct.workspace_id, date(ct.created_at)
order by day desc;

commit;
