-- Create storage bucket for agent file ingestion (used by Edge Function with service role)
insert into storage.buckets (id, name, public)
values ('agent_files', 'agent_files', false)
on conflict (id) do nothing;
