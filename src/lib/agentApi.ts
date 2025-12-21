import { supabase } from './supabase';

export async function ingestAgent(agentId: string, sources: any[], mode: 'retrain' | 'append' = 'retrain') {
  return supabase.functions.invoke('ingest', {
    body: { agent_id: agentId, sources, mode },
  });
}