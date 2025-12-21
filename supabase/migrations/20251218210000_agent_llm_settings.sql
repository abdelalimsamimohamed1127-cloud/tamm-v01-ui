-- Agent LLM settings for Tamm AI Agent
-- Adds configurable model/provider parameters (keeps defaults safe for MVP)

alter table public.agents
  add column if not exists llm_provider text not null default 'openai' check (llm_provider in ('openai')),
  add column if not exists llm_chat_model text not null default 'gpt-4o-mini',
  add column if not exists llm_embedding_model text not null default 'text-embedding-3-small',
  add column if not exists llm_temperature double precision not null default 0.3 check (llm_temperature >= 0 and llm_temperature <= 1),
  add column if not exists llm_max_output_tokens integer not null default 700 check (llm_max_output_tokens >= 1),
  add column if not exists rag_top_k integer not null default 8 check (rag_top_k >= 0 and rag_top_k <= 50),
  add column if not exists rag_min_similarity double precision not null default 0.0 check (rag_min_similarity >= 0 and rag_min_similarity <= 1);

-- Optional: speed up lookups by workspace+updated
create index if not exists agents_workspace_updated_idx on public.agents (workspace_id, updated_at desc);
