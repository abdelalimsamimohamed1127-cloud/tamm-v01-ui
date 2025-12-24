ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS sentiment TEXT
  CHECK (sentiment IN ('positive', 'neutral', 'negative')),
ADD COLUMN IF NOT EXISTS topic TEXT,
ADD COLUMN IF NOT EXISTS urgency TEXT
  CHECK (urgency IN ('low', 'medium', 'high'));
