import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import {
  ChannelDTO,
  UpsertChannelConfigDTO,
  AgentChannelStatus,
  ChannelPlatform,
} from "@/types/dto/channels.dto";


function ensureSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }
}

export async function getAgentChannels(workspaceId: string, agentId: string): Promise<ChannelDTO[]> {
  ensureSupabase();

  const { data, error } = await supabase
    .from("agent_channels")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("agent_id", agentId);

  if (error) throw error;
  return (data ?? []) as ChannelDTO[];
}

export async function upsertChannelConfig(payload: UpsertChannelConfigDTO) {
  ensureSupabase();

  const { error } = await supabase
    .from("agent_channels")
    .upsert(payload, { onConflict: "agent_id,platform" });

  if (error) throw error;
}

export async function disconnectChannel(id: string) {
  ensureSupabase();

  const { error } = await supabase
    .from("agent_channels")
    .update({ is_active: false, status: 'disconnected' })
    .eq("id", id);

  if (error) throw error;
}

export async function getAgentChannel(agentId: string, platform: ChannelPlatform): Promise<ChannelDTO | null> {
  ensureSupabase();

  const { data, error } = await supabase
    .from("agent_channels")
    .select("*")
    .eq("agent_id", agentId)
    .eq("platform", platform)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // No rows found
      return null;
    }
    throw error;
  }
  return (data as ChannelDTO) ?? null;
}