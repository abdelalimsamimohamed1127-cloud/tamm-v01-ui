import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ChannelRow = Database["public"]["Tables"]["channels"]["Row"];
export type ChannelType = "webchat" | "whatsapp_cloud" | "facebook_messenger";

type WebchatConfig = {
  theme?: "light" | "dark";
  welcome_message?: string;
};

type WhatsappCloudConfig = {
  phone_number_id?: string;
  business_name?: string;
};

type FacebookMessengerConfig = {
  page_id?: string;
  page_name?: string;
};

type ChannelConfigMap = {
  webchat: WebchatConfig;
  whatsapp_cloud: WhatsappCloudConfig;
  facebook_messenger: FacebookMessengerConfig;
};

type ChannelConfig = ChannelConfigMap[ChannelType];
type ChannelConfigFieldValidator = (value: unknown, channel: ChannelType, field: string) => void;

const CHANNEL_CONFIG_SCHEMAS: Record<ChannelType, Record<string, ChannelConfigFieldValidator>> = {
  webchat: {
    theme: (value, channel, field) => {
      if (typeof value !== "string" || (value !== "light" && value !== "dark")) {
        throw new Error(`Invalid ${channel} config: "${field}" must be "light" or "dark".`);
      }
    },
    welcome_message: (value, channel, field) => {
      if (typeof value !== "string") {
        throw new Error(`Invalid ${channel} config: "${field}" must be a string.`);
      }
    },
  },
  whatsapp_cloud: {
    phone_number_id: (value, channel, field) => {
      if (typeof value !== "string") {
        throw new Error(`Invalid ${channel} config: "${field}" must be a string.`);
      }
    },
    business_name: (value, channel, field) => {
      if (typeof value !== "string") {
        throw new Error(`Invalid ${channel} config: "${field}" must be a string.`);
      }
    },
  },
  facebook_messenger: {
    page_id: (value, channel, field) => {
      if (typeof value !== "string") {
        throw new Error(`Invalid ${channel} config: "${field}" must be a string.`);
      }
    },
    page_name: (value, channel, field) => {
      if (typeof value !== "string") {
        throw new Error(`Invalid ${channel} config: "${field}" must be a string.`);
      }
    },
  },
};

const SECRET_KEY_PATTERN = /(token|secret|key|password|bearer)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function assertNoExtraKeys(config: Record<string, unknown>, channel: ChannelType) {
  const allowedKeys = Object.keys(CHANNEL_CONFIG_SCHEMAS[channel]);
  const extraKeys = Object.keys(config).filter((key) => !allowedKeys.includes(key));

  if (extraKeys.length > 0) {
    throw new Error(`Unsupported ${channel} config keys: ${extraKeys.join(", ")}.`);
  }
}

function assertNoSecretLikeKeys(config: Record<string, unknown>, channel: ChannelType) {
  const forbiddenKeys = Object.keys(config).filter((key) => SECRET_KEY_PATTERN.test(key));
  if (forbiddenKeys.length > 0) {
    throw new Error(`Secrets are not allowed in ${channel} config: ${forbiddenKeys.join(", ")}.`);
  }
}

export function validateChannelConfig<TChannel extends ChannelType>(
  channel: TChannel,
  config: unknown
): ChannelConfigMap[TChannel] {
  if (!isPlainObject(config)) {
    throw new Error(`Channel config for ${channel} must be a plain object.`);
  }

  assertNoExtraKeys(config, channel);
  assertNoSecretLikeKeys(config, channel);

  const schema = CHANNEL_CONFIG_SCHEMAS[channel];
  const validatedEntries: Record<string, unknown> = {};

  for (const [field, validator] of Object.entries(schema)) {
    if (config[field] === undefined) continue;
    validator(config[field], channel, field);
    validatedEntries[field] = config[field];
  }

  return validatedEntries as ChannelConfigMap[TChannel];
}

export async function enableChannel(
  workspaceId: string,
  channel: ChannelType,
  config?: ChannelConfig
): Promise<ChannelRow> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  const metadata = config ? validateChannelConfig(channel, config) : {};

  const { data, error } = await supabase
    .from("channels")
    .insert({
      workspace_id: workspaceId,
      type: channel,
      status: "connected",
      connected_at: new Date().toISOString(),
      metadata,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateChannelConfig(
  channelId: string,
  channel: ChannelType,
  config: ChannelConfig
): Promise<ChannelRow> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  const metadata = validateChannelConfig(channel, config);

  const { data, error } = await supabase
    .from("channels")
    .update({ metadata })
    .eq("id", channelId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
