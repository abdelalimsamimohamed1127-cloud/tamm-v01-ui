-- Add system_prompt and config_jsonb columns to public.agents
ALTER TABLE public.agents ADD COLUMN system_prompt TEXT NULL;
ALTER TABLE public.agents ADD COLUMN config_jsonb JSONB DEFAULT '{}' NOT NULL;

-- Backfill config_jsonb from existing columns and then remove them
-- Assuming 'rules' was a single text field, we'll wrap it in a JSON array for consistency with templates.
-- If 'rules' could contain multiple rules delimited, more complex parsing would be needed here.
-- For system_prompt, we will set it null for existing agents, as it wasn't a column before.
-- In a real scenario, you'd potentially try to backfill system_prompt from agent_versions if applicable.

UPDATE public.agents
SET 
  config_jsonb = jsonb_build_object(
    'role', COALESCE(role, 'sales_assistant'),
    'tone', COALESCE(tone, 'friendly'),
    'language', COALESCE(language, 'ar'),
    'rules', CASE WHEN rules IS NOT NULL THEN jsonb_build_array(rules) ELSE '[]'::jsonb END
  ),
  system_prompt = NULL; -- Existing agents don't have system_prompt

-- Drop old columns
ALTER TABLE public.agents DROP COLUMN role;
ALTER TABLE public.agents DROP COLUMN tone;
ALTER TABLE public.agents DROP COLUMN language;
ALTER TABLE public.agents DROP COLUMN rules;