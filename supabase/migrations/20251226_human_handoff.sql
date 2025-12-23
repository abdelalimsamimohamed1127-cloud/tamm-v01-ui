-- Human handoff workflow for chat conversations

-- =========================================================
-- enum: conversation_status
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_status') THEN
    CREATE TYPE conversation_status AS ENUM (
      'open',
      'handoff_requested',
      'handoff_active',
      'resolved',
      'closed'
    );
  END IF;
END $$;

-- =========================================================
-- chat_sessions updates
-- =========================================================
-- ensure status column exists
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS status conversation_status;

-- migrate existing text status values into enum-compatible set
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_sessions'
      AND column_name = 'status'
      AND data_type = 'text'
  ) THEN
    UPDATE public.chat_sessions
    SET status = CASE status
      WHEN 'handoff' THEN 'handoff_active'
      WHEN 'archived' THEN 'closed'
      WHEN 'resolved' THEN 'resolved'
      WHEN 'handoff_requested' THEN 'handoff_requested'
      WHEN 'handoff_active' THEN 'handoff_active'
      WHEN 'closed' THEN 'closed'
      ELSE 'open'
    END
    WHERE status IS NOT NULL;

    ALTER TABLE public.chat_sessions
      ALTER COLUMN status TYPE conversation_status
      USING CASE status
        WHEN 'handoff' THEN 'handoff_active'::conversation_status
        WHEN 'archived' THEN 'closed'::conversation_status
        ELSE status::conversation_status
      END;
  END IF;
END $$;

-- set defaults and constraints for status
UPDATE public.chat_sessions
  SET status = 'open'
  WHERE status IS NULL;

ALTER TABLE public.chat_sessions
  ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.chat_sessions
  ALTER COLUMN status SET DEFAULT 'open';

-- assigned_to with FK
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.chat_sessions
  DROP CONSTRAINT IF EXISTS chat_sessions_assigned_to_fkey;
ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

-- sla_breach_at and handoff_reason
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS sla_breach_at timestamptz;
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS handoff_reason text;

-- =========================================================
-- chat_messages updates
-- =========================================================
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_internal_note boolean NOT NULL DEFAULT false;

-- =========================================================
-- RLS updates for chat_sessions
-- =========================================================
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_sessions_update_service_role ON public.chat_sessions;
CREATE POLICY chat_sessions_update_service_role
ON public.chat_sessions
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS chat_sessions_update_workspace_members ON public.chat_sessions;
CREATE POLICY chat_sessions_update_workspace_members
ON public.chat_sessions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = chat_sessions.workspace_id
      AND wm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = chat_sessions.workspace_id
      AND wm.user_id = auth.uid()
  )
);
