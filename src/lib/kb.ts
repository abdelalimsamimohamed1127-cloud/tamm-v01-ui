import { supabase } from '@/integrations/supabase/client';

export type KnowledgeSource = {
  id: string;
  workspace_id: string;
  agent_id: string;
  type: 'file' | 'text' | 'website' | 'qa' | 'catalog';
  title: string | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  meta: any;
  created_at: string;
  updated_at: string;
};

export type KbJob = {
  id: string;
  workspace_id: string;
  agent_id: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  total_sources: number;
  processed_sources: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export async function listSources(agentId: string) {
  const { data, error } = await supabase
    .from('kb_sources')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as KnowledgeSource[];
}

export async function createSource(input: Partial<KnowledgeSource> & { agent_id: string; workspace_id: string; type: KnowledgeSource['type']; }) {
  const { data, error } = await supabase
    .from('kb_sources')
    .insert({
      workspace_id: input.workspace_id,
      agent_id: input.agent_id,
      type: input.type,
      title: input.title ?? null,
      status: 'pending',
      meta: input.meta ?? {},
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as KnowledgeSource;
}

export async function deleteSource(sourceId: string) {
  const { error } = await supabase.from('kb_sources').delete().eq('id', sourceId);
  if (error) throw error;
}

export async function getLatestJob(agentId: string) {
  const { data, error } = await supabase
    .from('kb_jobs')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as KbJob | null;
}

export async function startRetrain(agentId: string) {
  const { data, error } = await supabase.functions.invoke('kb-retrain', { body: { agent_id: agentId } });
  if (error) throw error;
  return data;
}

export async function chatWithAgent(agentId: string, message: string) {
  const { data, error } = await supabase.functions.invoke('agent-chat', { body: { agent_id: agentId, message } });
  if (error) throw error;
  return data as { reply: string; citations?: any[] };
}
