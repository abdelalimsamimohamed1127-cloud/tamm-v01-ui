import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export type AgentChannel = "webchat" | "whatsapp_cloud" | "facebook_messenger";

export type AgentChannelConfig = Record<string, unknown>;

export type AgentChannelState = {
  channel: AgentChannel;
  is_enabled: boolean;
  config: AgentChannelConfig;
};

export type AgentChannelReadModel = {
  channels: AgentChannelState[];
};

const SUPPORTED_CHANNELS: AgentChannel[] = [
  "webchat",
  "whatsapp_cloud",
  "facebook_messenger",
];

function ensureObjectConfig(config: unknown): AgentChannelConfig {
  if (config && typeof config === "object" && !Array.isArray(config)) {
    return config as AgentChannelConfig;
  }
  return {};
}

export function createDefaultChannelState(): AgentChannelReadModel {
  return {
    channels: SUPPORTED_CHANNELS.map((channel) => ({
      channel,
      is_enabled: false,
      config: {},
    })),
  };
}

export async function getChannelStateForAgent(agent_id: string | null | undefined): Promise<AgentChannelReadModel> {
  const fallback = createDefaultChannelState();

  if (!agent_id || !supabase || !isSupabaseConfigured) {
    return fallback;
  }

  const { data, error } = await supabase
    .from("agent_channels")
    .select("channel,is_enabled,config")
    .eq("agent_id", agent_id);

  if (error) {
    return fallback;
  }

  const rows = Array.isArray(data) ? data : [];
  const byChannel = new Map<AgentChannel, { channel: AgentChannel; is_enabled: boolean | null; config: unknown }>();

  for (const row of rows) {
    if (SUPPORTED_CHANNELS.includes(row.channel as AgentChannel)) {
      byChannel.set(row.channel as AgentChannel, row as { channel: AgentChannel; is_enabled: boolean | null; config: unknown });
    }
  }

  return {
    channels: SUPPORTED_CHANNELS.map((channel) => {
      const row = byChannel.get(channel);
      return {
        channel,
        is_enabled: Boolean(row?.is_enabled),
        config: ensureObjectConfig(row?.config),
      };
    }),
  };
}
