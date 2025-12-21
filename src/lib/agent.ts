import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

export type Agent = {
  id: string;
  workspace_id: string;
  name: string;
  role: string | null;
  tone: string | null;
  language: string | null;
  rules: string | null;
  status?: string | null;
  is_active?: boolean | null;
  llm_chat_model?: string | null;
  llm_temperature?: number | null;
  rag_top_k?: number | null;
  last_trained_at?: string | null;
};

export async function getOrCreateAgent(workspaceId: string) {
  const { data: existing, error: selErr } = await supabase
    .from('agents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!selErr && existing) return existing as Agent;

  // If table doesn't exist or RLS blocks, throw the original error
  if (selErr && !String(selErr.message || '').includes('relation') && !String(selErr.message || '').includes('does not exist')) {
    throw selErr;
  }

  const { data, error } = await supabase
    .from('agents')
    .insert({ workspace_id: workspaceId, name: 'My Agent', llm_chat_model: 'gpt-4o-mini', llm_temperature: 0.2, rag_top_k: 5 })
    .select('*')
    .single();

  if (error) throw error;
  return data as Agent;
}

export async function updateAgent(agentId: string, patch: Partial<Agent>) {
  const { data, error } = await supabase
    .from('agents')
    .update(patch)
    .eq('id', agentId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Agent;
}

export async function getAgentForWorkspace(workspaceId: string) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as Agent) ?? null;
}
