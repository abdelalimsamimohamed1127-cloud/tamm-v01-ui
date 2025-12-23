-- Add analytics enrichment fields to conversations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'sentiment_score'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN sentiment_score int2;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'primary_topic'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN primary_topic text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'tags'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN tags text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'urgency'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN urgency text;
  END IF;
END $$;

-- Constraints for allowed values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_sentiment_score_check'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_sentiment_score_check
      CHECK (sentiment_score IS NULL OR sentiment_score IN (-1, 0, 1));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_urgency_check'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_urgency_check
      CHECK (urgency IS NULL OR urgency IN ('high', 'low'));
  END IF;
END $$;
