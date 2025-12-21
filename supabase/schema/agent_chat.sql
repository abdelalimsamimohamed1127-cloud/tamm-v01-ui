-- Vector similarity search helper for RAG
-- Requires: create extension if not exists vector;

create or replace function match_agent_embeddings(
  p_agent_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 8
)
returns table (
  id uuid,
  source_id uuid,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    e.id,
    e.source_id,
    e.content,
    1 - (e.embedding <=> p_query_embedding) as similarity
  from agent_embeddings e
  where e.agent_id = p_agent_id
  order by e.embedding <=> p_query_embedding
  limit p_match_count;
$$;