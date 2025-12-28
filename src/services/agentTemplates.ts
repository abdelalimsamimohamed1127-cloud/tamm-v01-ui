import { supabase } from '@/integrations/supabase/client';

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  config_jsonb: {
    role?: string;
    tone?: string;
    language?: string;
    system_prompt?: string;
    rules?: string[]; // Assuming rules are an array of strings in config_jsonb
    // Add other potential config fields here as needed
  };
  created_at: string;
  is_active: boolean;
  created_by: string | null;
}

export async function getAgentTemplates(): Promise<AgentTemplate[]> {
  const { data, error } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error("Error fetching agent templates:", error);
    throw new Error(error.message);
  }

  return data as AgentTemplate[];
}