import { supabase } from './supabase';
import { DEFAULT_SYSTEM_PROMPT } from '@/components/ai-agent/constants/agentDefaults';

export async function ensureAgent(workspaceId: string) {
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .limit(1);

  if (error) throw error;

  if (agents && agents.length > 0) return agents[0];

  const { data: agent, error: createErr } = await supabase
    .from('agents')
    .insert({
      workspace_id: workspaceId,
      name: 'Default AI Agent',
      model: 'gpt-4o',
      temperature: 0.2,
      trained: false,
      system_prompt: DEFAULT_SYSTEM_PROMPT,
    })
    .select()
    .single();

  if (createErr) throw createErr;
  return agent;
}