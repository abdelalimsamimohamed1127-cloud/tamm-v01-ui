-- Add raw_text storage for inline sources
ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS raw_text TEXT;

-- Ensure pgvector extension remains available for embeddings
CREATE EXTENSION IF NOT EXISTS "vector";
