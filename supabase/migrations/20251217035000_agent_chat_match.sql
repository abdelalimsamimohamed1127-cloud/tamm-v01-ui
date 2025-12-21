-- Enable match function for agent chat retrieval
create or replace function public.match_knowledge_embeddings(
  query_embedding vector(1536),
  match_count int,
  workspace_id uuid,
  agent_id uuid default null
)
returns table (
  chunk_id uuid,
  content text,
  source_id uuid,
  title text,
  similarity double precision
)
language sql
stable
as $$
  select
    kc.id as chunk_id,
    kc.content,
    ks.id as source_id,
    ks.title,
    1 - (ke.embedding <=> query_embedding) as similarity
  from knowledge_embeddings ke
  join knowledge_chunks kc on kc.id = ke.chunk_id
  join knowledge_sources ks on ks.id = kc.source_id
  where ks.workspace_id = workspace_id
    and (
      agent_id is null
        and ks.agent_id is null
      or agent_id is not null
        and (ks.agent_id = agent_id or ks.agent_id is null)
    )
  order by ke.embedding <=> query_embedding
  limit match_count;
$$;
