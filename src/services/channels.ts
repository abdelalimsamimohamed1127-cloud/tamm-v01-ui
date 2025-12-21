import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export type ChannelType = "webchat" | "whatsapp_cloud" | "facebook_messenger";

export type AgentChannel = {
  agent_id: string;
  channel: ChannelType;
  is_enabled: boolean;
  workspace_id?: string;
  created_at?: string;
};

function assertSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }
}

export async function getChannelsForAgent(agentId: string): Promise<AgentChannel[]> {
  assertSupabase();

  const { data, error } = await supabase
    .from("agent_channels")
    .select("*")
    .eq("agent_id", agentId);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    channel: row.channel as ChannelType,
    is_enabled: Boolean(row.is_enabled),
  }));
}

export async function enableChannel(agentId: string, channel: ChannelType): Promise<AgentChannel> {
  assertSupabase();

  const { data, error } = await supabase
    .from("agent_channels")
    .upsert(
      { agent_id: agentId, channel, is_enabled: true },
      { onConflict: "agent_id,channel" }
    )
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    channel: data.channel as ChannelType,
    is_enabled: Boolean(data.is_enabled),
  } as AgentChannel;
}

export async function disableChannel(agentId: string, channel: ChannelType): Promise<AgentChannel | null> {
  assertSupabase();

  const { data, error } = await supabase
    .from("agent_channels")
    .update({ is_enabled: false })
    .eq("agent_id", agentId)
    .eq("channel", channel)
    .select()
    .maybeSingle();

  if (error) throw error;

  return data
    ? ({
        ...data,
        channel: data.channel as ChannelType,
        is_enabled: Boolean(data.is_enabled),
      } as AgentChannel)
    : null;
}
