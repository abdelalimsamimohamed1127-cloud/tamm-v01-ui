-- Create the agent_templates table
CREATE TABLE public.agent_templates (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    description text,
    config_jsonb jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT TRUE,
    created_by uuid NULL -- Nullable for system/admin templates
);

-- Enable Row Level Security
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read (SELECT) templates
CREATE POLICY "Authenticated users can view agent templates"
ON public.agent_templates FOR SELECT
TO authenticated
USING (TRUE);

-- Policy for admin users to insert agent templates
-- For now, this policy allows authenticated users to insert.
-- The actual "admin only" restriction for write operations must be enforced by the backend API.
-- In a more robust RLS setup, this would check `auth.jwt() -> 'app_metadata' ->> 'user_role' = 'admin'`
-- or similar, assuming such claims are populated by the auth system.
CREATE POLICY "Admins can create agent templates"
ON public.agent_templates FOR INSERT
TO authenticated
WITH CHECK (TRUE);

-- Policy for admin users to update agent templates
CREATE POLICY "Admins can update agent templates"
ON public.agent_templates FOR UPDATE
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);

-- Policy for admin users to delete agent templates
CREATE POLICY "Admins can delete agent templates"
ON public.agent_templates FOR DELETE
TO authenticated
USING (TRUE);


-- Seed built-in agent templates
INSERT INTO public.agent_templates (id, name, description, config_jsonb, created_by)
VALUES
    (uuid_generate_v4(), 'Customer Support Agent', 'An agent designed to assist customers with common queries and support issues.', '{
        "role": "Customer Support Agent",
        "tone": "helpful and empathetic",
        "prompt": "You are a customer support agent for our company. Your goal is to provide excellent service by answering questions, troubleshooting problems, and guiding users through solutions. Be patient and polite. If you cannot resolve an issue, offer to escalate to a human.",
        "rules": [
            "Always maintain a positive and helpful demeanor.",
            "Prioritize user satisfaction.",
            "Escalate complex issues when necessary.",
            "Do not provide personal opinions or off-topic information."
        ]
    }', NULL),
    (uuid_generate_v4(), 'Sales Assistant', 'An agent focused on assisting sales efforts, answering product questions, and qualifying leads.', '{
        "role": "Sales Assistant",
        "tone": "enthusiastic and persuasive",
        "prompt": "You are a sales assistant for our products. Your task is to inform potential customers about our offerings, highlight benefits, answer product-related questions, and help qualify leads. Aim to gently guide users towards making a purchase.",
        "rules": [
            "Clearly explain product features and benefits.",
            "Identify customer needs and suggest relevant products.",
            "Avoid overly aggressive sales tactics.",
            "Collect lead information if the user shows interest."
        ]
    }', NULL),
    (uuid_generate_v4(), 'Internal Ops Agent', 'An agent for internal team operations, helping with common HR, IT, or project management questions.', '{
        "role": "Internal Operations Assistant",
        "tone": "formal and efficient",
        "prompt": "You are an internal operations assistant for our company. Provide quick and accurate information regarding company policies, IT support, and project guidelines. Your responses should be concise and direct.",
        "rules": [
            "Only use approved internal documentation for answers.",
            "Do not disclose confidential information.",
            "Direct users to the appropriate department for further assistance if needed.",
            "Maintain a professional and objective tone."
        ]
    }', NULL);