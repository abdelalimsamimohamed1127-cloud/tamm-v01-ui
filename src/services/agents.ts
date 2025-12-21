import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AgentRow = Database["public"]["Tables"]["agents"]["Row"] & {
  is_active?: boolean | null;
};

type AgentUpdate = Database["public"]["Tables"]["agents"]["Update"] & {
  is_active?: boolean | null;
};

export type Agent = AgentRow;

export async function getAgentForWorkspace(workspaceId: string): Promise<Agent | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as Agent) ?? null;
}

async function setAgentActiveState(agentId: string, isActive: boolean): Promise<Agent> {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase is not configured");

  const patch: AgentUpdate = { is_active: isActive };

  const { data, error } = await supabase
    .from("agents")
    .update(patch)
    .eq("id", agentId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Agent;
}

export async function deactivateAgent(agentId: string) {
  return setAgentActiveState(agentId, false);
}

export async function reactivateAgent(agentId: string) {
  return setAgentActiveState(agentId, true);
}
