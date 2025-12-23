import { z, ZodError, type ZodTypeAny } from "zod";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export type ChannelPlatform = "webchat" | "whatsapp" | "messenger" | "email";

export interface AgentChannel {
  id: string;
  agent_id: string;
  platform: ChannelPlatform;
  config: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function ensureSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }
}

export async function getAgentChannels(agentId: string): Promise<AgentChannel[]> {
  ensureSupabase();

  const { data, error } = await supabase
    .from("agent_channels")
    .select("*")
    .eq("agent_id", agentId);

  if (error) throw error;
  return (data ?? []) as AgentChannel[];
}

export async function toggleChannel(agentId: string, platform: ChannelPlatform, isActive: boolean) {
  ensureSupabase();

  const { error } = await supabase
    .from("agent_channels")
    .upsert(
      { agent_id: agentId, platform, is_active: isActive },
      { onConflict: "agent_id,platform" }
    );

  if (error) throw error;
}

export async function updateChannelConfig(
  agentId: string,
  platform: ChannelPlatform,
  config: unknown
) {
  ensureSupabase();

  const { error } = await supabase
    .from("agent_channels")
    .update({ config })
    .eq("agent_id", agentId)
    .eq("platform", platform);

  if (error) throw error;
}
