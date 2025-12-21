# Knowledge Base data model and workspace scoping

This migration introduces the Knowledge Base (RAG) foundation in Supabase and keeps every asset scoped to a workspace.

## Tables
- `knowledge_sources` stores high-level ingestion items tied to a `workspace_id` (and optional `agent_id`).
- `knowledge_chunks` breaks sources into ordered pieces (`chunk_index`) for reconstruction.
- `knowledge_embeddings` stores vector embeddings (`vector(1536)`) for chunks and supports IVFFlat similarity search.

## Row-Level Security
Workspace scoping reuses the existing `public.is_workspace_member(workspace_id)` helper:
- `knowledge_sources` policies gate all access on `workspace_id` membership.
- `knowledge_chunks` and `knowledge_embeddings` policies join through their parent source so only members of the parent workspace can read/write.

## Storage bucket `kb`
- Bucket `kb` stores uploaded artifacts. Objects must be namespaced as `<workspace_id>/...`.
- Policies on `storage.objects` extract the workspace UUID prefix and call `is_workspace_member`, allowing only authenticated workspace members to upload, update, list, or download objects in their own workspace path.
