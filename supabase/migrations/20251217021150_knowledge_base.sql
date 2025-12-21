-- Knowledge Base (RAG) foundation

-- Ensure pgvector is available for embeddings
CREATE EXTENSION IF NOT EXISTS "vector";

-- Knowledge sources track origin and ingestion status
CREATE TABLE public.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  agent_id UUID,
  type TEXT NOT NULL CHECK (type IN ('file', 'text', 'url', 'qa')),
  title TEXT,
  source_url TEXT,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

-- Chunks are derived from sources and keep ordering for reconstruction
CREATE TABLE public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT knowledge_chunks_source_chunk_unique UNIQUE (source_id, chunk_index)
);

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Embeddings pair chunks with vector representations
CREATE TABLE public.knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID REFERENCES public.knowledge_chunks(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- Indexes to accelerate lookups and vector similarity search
CREATE INDEX IF NOT EXISTS knowledge_embeddings_chunk_id_idx ON public.knowledge_embeddings (chunk_id);
CREATE INDEX IF NOT EXISTS knowledge_embeddings_embedding_ivfflat_idx
  ON public.knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS policies scoped to workspace membership
CREATE POLICY "Members can view knowledge_sources" ON public.knowledge_sources
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can manage knowledge_sources" ON public.knowledge_sources
  FOR ALL USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can view knowledge_chunks" ON public.knowledge_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_sources ks
      WHERE ks.id = knowledge_chunks.source_id
        AND public.is_workspace_member(ks.workspace_id)
    )
  );

CREATE POLICY "Members can manage knowledge_chunks" ON public.knowledge_chunks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_sources ks
      WHERE ks.id = knowledge_chunks.source_id
        AND public.is_workspace_member(ks.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.knowledge_sources ks
      WHERE ks.id = knowledge_chunks.source_id
        AND public.is_workspace_member(ks.workspace_id)
    )
  );

CREATE POLICY "Members can view knowledge_embeddings" ON public.knowledge_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.knowledge_chunks kc
      JOIN public.knowledge_sources ks ON ks.id = kc.source_id
      WHERE kc.id = knowledge_embeddings.chunk_id
        AND public.is_workspace_member(ks.workspace_id)
    )
  );

CREATE POLICY "Members can manage knowledge_embeddings" ON public.knowledge_embeddings
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.knowledge_chunks kc
      JOIN public.knowledge_sources ks ON ks.id = kc.source_id
      WHERE kc.id = knowledge_embeddings.chunk_id
        AND public.is_workspace_member(ks.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.knowledge_chunks kc
      JOIN public.knowledge_sources ks ON ks.id = kc.source_id
      WHERE kc.id = knowledge_embeddings.chunk_id
        AND public.is_workspace_member(ks.workspace_id)
    )
  );

-- Storage bucket for knowledge base assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('kb', 'kb', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Helper to safely derive workspace id from object path (expects <workspace_id>/...)
CREATE OR REPLACE FUNCTION public.workspace_id_from_storage_path(object_name text)
RETURNS uuid
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(object_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN split_part(object_name, '/', 1)::uuid
    ELSE NULL
  END;
$$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read kb objects" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'kb'
    AND public.is_workspace_member(public.workspace_id_from_storage_path(name))
  );

CREATE POLICY "Workspace members can manage kb objects" ON storage.objects
  FOR ALL USING (
    bucket_id = 'kb'
    AND public.is_workspace_member(public.workspace_id_from_storage_path(name))
  )
  WITH CHECK (
    bucket_id = 'kb'
    AND public.is_workspace_member(public.workspace_id_from_storage_path(name))
  );
