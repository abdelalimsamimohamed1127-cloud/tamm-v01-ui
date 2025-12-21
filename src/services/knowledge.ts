import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export type KnowledgeSourceType = "csv" | "pdf" | "docx" | "txt" | "url" | "manual";

export type KnowledgeSource = {
  id: string;
  workspace_id: string;
  agent_id: string;
  type: KnowledgeSourceType;
  title: string;
  status: string;
  created_at: string;
};

export type KnowledgeSourcePayload = {
  workspace_id: string;
  agent_id: string;
  type: KnowledgeSourceType;
  title: string;
};

export async function createKnowledgeSource(payload: KnowledgeSourcePayload): Promise<KnowledgeSource> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from("agent_knowledge_sources")
    .insert({ ...payload, status: "uploaded" })
    .select()
    .single();

  if (error) throw error;
  return data as KnowledgeSource;
}

export async function getKnowledgeSourcesForAgent(agentId: string): Promise<KnowledgeSource[]> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from("agent_knowledge_sources")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as KnowledgeSource[];
}
