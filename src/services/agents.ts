import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AgentRow = Database["public"]["Tables"]["agents"]["Row"] & {
  is_active?: boolean | null;
};

type AgentUpdate = Database["public"]["Tables"]["agents"]["Update"] & {
  is_active?: boolean | null;
  // Explicitly add fields that will be updated if they are not part of basic AgentUpdate
  role?: string | null;
  tone?: string | null;
  language?: string | null;
  system_prompt?: string | null;
  rules_jsonb?: Record<string, any> | null;
  status?: string | null;
};

export type Agent = AgentRow;

export async function getAgent(agentId: string): Promise<Agent | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (error) throw error;
  return (data as Agent) ?? null;
}

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

export async function listAgents(workspaceId: string): Promise<Agent[]> {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Agent[];
}

export async function createAgent(
  payload: Omit<AgentUpdate, "id" | "created_at" | "status"> & { workspace_id: string }
): Promise<Agent> {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase is not configured");
  if (!payload.name) throw new Error("Agent name is required.");
  if (!payload.workspace_id) throw new Error("Workspace ID is required for agent creation.");

  const { data, error } = await supabase
    .from("agents")
    .insert([{ ...payload, status: payload.status || "draft" }])
    .select("*")
    .single();

  if (error) throw error;
  return data as Agent;
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

export async function deleteAgent(agentId: string, workspaceId: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase is not configured");

  const { error } = await supabase
    .from("agents")
    .delete()
    .eq("id", agentId)
    .eq("workspace_id", workspaceId); // Ensure workspace scoping for deletion

  if (error) throw error;
}

export async function updateAgent(agentId: string, payload: Partial<AgentUpdate>): Promise<Agent> {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase is not configured");

  // Filter payload to only include allowed update fields
  const allowedFields: Array<keyof AgentUpdate> = [
    'name', 'description', 'is_active', 'status',
    'role', 'tone', 'language', 'system_prompt', 'rules_jsonb'
  ];
  
  const filteredPayload: Partial<AgentUpdate> = {};
  for (const key of allowedFields) {
    if (key in payload) {
      filteredPayload[key] = payload[key];
    }
  }

  if (Object.keys(filteredPayload).length === 0) {
    // No allowed fields to update
    throw new Error("No valid fields provided for agent update.");
  }

  const { data, error } = await supabase
    .from("agents")
    .update(filteredPayload)
    .eq("id", agentId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Agent;
}


// --- Agent Versioning Functions ---

export type AgentVersion = Database["public"]["Tables"]["agent_versions"]["Row"];

export async function createDraftVersion(
  agentId: string,
  payload: { system_prompt: string | null; rules_jsonb: Record<string, any> | null }
): Promise<AgentVersion> {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase is not configured");

  // Fetch the latest version number for the agent
  const { data: latestVersionData, error: latestVersionError } = await supabase
    .from("agent_versions")
    .select("version_number")
    .eq("agent_id", agentId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  const nextVersionNumber = latestVersionData ? latestVersionData.version_number + 1 : 1;

  // Insert new draft version
  const { data: newVersionData, error: newVersionError } = await supabase
    .from("agent_versions")
    .insert({
      agent_id: agentId,
      version_number: nextVersionNumber,
      system_prompt: payload.system_prompt,
      rules_jsonb: payload.rules_jsonb,
    })
    .select("*")
    .single();

  if (newVersionError) throw newVersionError;

  // Update agent's draft_version_id
  const { error: updateAgentError } = await supabase
    .from("agents")
    .update({ draft_version_id: newVersionData.id })
    .eq("id", agentId);

  if (updateAgentError) throw updateAgentError;

  return newVersionData as AgentVersion;
}

export async function publishDraft(agentId: string): Promise<Agent> {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase is not configured");

  // Fetch the current agent to get draft_version_id
  const { data: agentData, error: fetchError } = await supabase
    .from("agents")
    .select("draft_version_id")
    .eq("id", agentId)
    .single();

  if (fetchError) throw fetchError;
  if (!agentData?.draft_version_id) throw new Error("No draft version to publish.");

  // Update agent's published_version_id and clear draft_version_id
  const { data: updatedAgentData, error: updateError } = await supabase
    .from("agents")
    .update({
      published_version_id: agentData.draft_version_id,
      draft_version_id: null,
    })
    .eq("id", agentId)
    .select("*")
    .single();

  if (updateError) throw updateError;
  return updatedAgentData as Agent;
}

export async function rollbackAgent(agentId: string, versionId: string): Promise<Agent> {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase is not configured");

  // Optionally, verify that versionId belongs to agentId to prevent malicious rollback
  const { data: versionCheck, error: versionCheckError } = await supabase
    .from("agent_versions")
    .select("id")
    .eq("id", versionId)
    .eq("agent_id", agentId)
    .single();

  if (versionCheckError) throw versionCheckError;
  if (!versionCheck) throw new Error("Version not found or does not belong to this agent.");

  // Update agent's published_version_id
  const { data: updatedAgentData, error: updateError } = await supabase
    .from("agents")
    .update({ published_version_id: versionId })
    .eq("id", agentId)
    .select("*")
    .single();

  if (updateError) throw updateError;
  return updatedAgentData as Agent;
}

export async function listAgentVersions(agentId: string): Promise<AgentVersion[]> {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("agent_versions")
    .select("*")
    .eq("agent_id", agentId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return data as AgentVersion[];
}
