-- Ensure agents.updated_at is refreshed on every update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trigger_agents_updated_at on public.agents;
drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trigger_agents_updated_at
before update on public.agents
for each row execute function public.set_updated_at();
