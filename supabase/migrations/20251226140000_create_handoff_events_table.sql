-- Create handoff_events table for tracking conversation handoffs
CREATE TABLE public.handoff_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  from_status text NOT NULL, -- e.g., 'open', 'ai_active'
  to_status text NOT NULL,   -- e.g., 'handoff'
  initiated_by uuid,         -- User who initiated the handoff (optional)
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.handoff_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Workspace members can read handoff events for their conversations
DROP POLICY IF EXISTS "workspace_member_can_read_handoff_events" ON public.handoff_events;
CREATE POLICY "workspace_member_can_read_handoff_events"
ON public.handoff_events
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id AND public.is_workspace_member(c.workspace_id)
    )
);

-- RLS Policy: System/Admin can insert handoff events (triggered by backend logic)
DROP POLICY IF EXISTS "system_can_insert_handoff_events" ON public.handoff_events;
CREATE POLICY "system_can_insert_handoff_events"
ON public.handoff_events
FOR INSERT
TO authenticated -- Or 'service_role'
WITH CHECK (
    public.is_admin() OR auth.role() = 'service_role'
);
