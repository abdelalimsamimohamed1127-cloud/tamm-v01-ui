import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type AgentStatus = "active" | "inactive";

type AgentRow = Database["public"]["Tables"]["agents"]["Row"] & { status?: AgentStatus | null };
type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"] & { status?: AgentStatus | null };

const AGENT_EXISTS_MESSAGE = "Agent already exists for this workspace";

function ensureSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured");
  }
}

function agentExists(agent: AgentRow | null) {
  if (!agent) return false;
  const status = (agent as { status?: AgentStatus | null }).status;
  return status === "active" || status === "inactive" || typeof status === "undefined" || status === null;
}

export async function getAgentForWorkspace(workspaceId: string): Promise<AgentRow | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as AgentRow) ?? null;
}

export async function createAgent(payload: AgentInsert): Promise<AgentRow> {
  ensureSupabase();

  const existing = await getAgentForWorkspace(payload.workspace_id);
  if (agentExists(existing)) {
    throw new Error(AGENT_EXISTS_MESSAGE);
  }

  const { data, error } = await supabase!
    .from("agents")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as AgentRow;
}

export async function updateAgent(agentId: string, workspaceId: string, patch: Partial<AgentInsert>): Promise<AgentRow> {
  ensureSupabase();

  const existing = await getAgentForWorkspace(workspaceId);
  if (!existing) {
    throw new Error("No agent exists for this workspace");
  }
  if (existing.id !== agentId) {
    throw new Error("Only the existing workspace agent can be updated");
  }

  const { data, error } = await supabase!
    .from("agents")
    .update(patch)
    .eq("id", agentId)
    .select("*")
    .single();

  if (error) throw error;
  return data as AgentRow;
}

async function setAgentStatus(workspaceId: string, status: AgentStatus) {
  ensureSupabase();

  const existing = await getAgentForWorkspace(workspaceId);
  if (!existing) {
    throw new Error("No agent exists for this workspace");
  }
  return updateAgent(existing.id, workspaceId, { status });
}

export async function deactivateAgent(workspaceId: string) {
  return setAgentStatus(workspaceId, "inactive");
}

export async function reactivateAgent(workspaceId: string) {
  return setAgentStatus(workspaceId, "active");
}
