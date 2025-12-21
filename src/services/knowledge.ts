import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export type KnowledgeSource = {
  id: string;
  workspace_id: string;
  agent_id: string;
  type: "file" | "text" | "website" | "qa" | "catalog" | string;
  title: string | null;
  status: "pending" | "processing" | "ready" | "failed" | string;
  meta: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type KnowledgeSourcesResult = {
  status: "empty" | "loaded";
  sources: KnowledgeSource[];
};

export async function getKnowledgeSourcesForAgent(agentId: string): Promise<KnowledgeSourcesResult> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from("agent_knowledge_sources")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const sources = (data ?? []) as KnowledgeSource[];

  return {
    status: sources.length === 0 ? "empty" : "loaded",
    sources,
  };
}
