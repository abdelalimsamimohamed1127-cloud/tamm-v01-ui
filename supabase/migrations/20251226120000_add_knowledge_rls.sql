-- Add RLS policies for public.agent_sources and public.agent_embeddings

-- Enable RLS on agent_sources
ALTER TABLE public.agent_sources ENABLE ROW LEVEL SECURITY;

-- Policy for workspace members to read agent_sources
DROP POLICY IF EXISTS agent_sources_select_policy ON public.agent_sources;
CREATE POLICY agent_sources_select_policy
ON public.agent_sources
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_workspace_member(a.workspace_id))
);

-- Policy for workspace admins to insert agent_sources
DROP POLICY IF EXISTS agent_sources_insert_policy ON public.agent_sources;
CREATE POLICY agent_sources_insert_policy
ON public.agent_sources
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_admin()) -- Assuming public.is_admin() implies admin for current workspace if RLS is strict
  AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_workspace_member(a.workspace_id))
);

-- Policy for workspace admins to update agent_sources (e.g., status changes)
DROP POLICY IF EXISTS agent_sources_update_policy ON public.agent_sources;
CREATE POLICY agent_sources_update_policy
ON public.agent_sources
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_workspace_member(a.workspace_id))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_admin())
);


-- Policy for workspace admins to delete agent_sources
DROP POLICY IF EXISTS agent_sources_delete_policy ON public.agent_sources;
CREATE POLICY agent_sources_delete_policy
ON public.agent_sources
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_admin())
  AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_workspace_member(a.workspace_id))
);


-- Enable RLS on agent_embeddings
ALTER TABLE public.agent_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy for workspace members to read agent_embeddings
DROP POLICY IF EXISTS agent_embeddings_select_policy ON public.agent_embeddings;
CREATE POLICY agent_embeddings_select_policy
ON public.agent_embeddings
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_workspace_member(a.workspace_id))
);

-- Policy for workspace admins to insert agent_embeddings (likely done by backend)
DROP POLICY IF EXISTS agent_embeddings_insert_policy ON public.agent_embeddings;
CREATE POLICY agent_embeddings_insert_policy
ON public.agent_embeddings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_admin()) -- Backend ingestion process acts as admin
  AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_workspace_member(a.workspace_id))
);

-- Policy for workspace admins to delete agent_embeddings (cascade from source or agent deletion)
DROP POLICY IF EXISTS agent_embeddings_delete_policy ON public.agent_embeddings;
CREATE POLICY agent_embeddings_delete_policy
ON public.agent_embeddings
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_admin())
  AND EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND public.is_workspace_member(a.workspace_id))
);
