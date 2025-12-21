-- Fix is_workspace_member function without dropping (avoids dependency issues)
-- Ensures parameter name stays workspace_id to prevent "cannot change name of input parameter"
CREATE OR REPLACE FUNCTION public.is_workspace_member(workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = is_workspace_member.workspace_id
      AND wm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = is_workspace_member.workspace_id
      AND w.owner_id = auth.uid()
  );
$$;
