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

const whatsappSchema = z.object({
  phone_number_id: z.string().min(10, "phone_number_id is required"),
  system_user_token: z
    .string()
    .regex(/^EA.*/, "system_user_token must start with 'EA'"),
  verify_token: z.string().min(5, "verify_token is required"),
});

const messengerSchema = z.object({
  page_id: z.string().regex(/^\d+$/, "page_id must be numeric"),
  access_token: z.string().min(1, "access_token is required"),
  verify_token: z.string().min(1, "verify_token is required"),
});

const webchatSchema = z.object({
  theme_color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "theme_color must be a hex color")
    .optional(),
  welcome_message: z.string().max(200, "welcome_message must be 200 characters or less").optional(),
  position: z.enum(["bottom-right", "bottom-left"]).optional(),
});

const emailSchema = z.object({});

export const CHANNEL_SCHEMAS: Record<ChannelPlatform, ZodTypeAny> = {
  whatsapp: whatsappSchema,
  messenger: messengerSchema,
  webchat: webchatSchema,
  email: emailSchema,
};

function ensureSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }
}

function validateConfig(platform: ChannelPlatform, config: unknown) {
  const schema = CHANNEL_SCHEMAS[platform];

  try {
    schema.parse(config ?? {});
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.errors[0];
      const prefix =
        platform === "whatsapp"
          ? "Invalid WhatsApp configuration"
          : platform === "messenger"
          ? "Invalid Messenger configuration"
          : platform === "webchat"
          ? "Invalid Webchat configuration"
          : "Invalid Email configuration";
      const issueMessage = firstIssue?.message || "Invalid configuration";
      throw new Error(`${prefix}: ${issueMessage}`);
    }
    throw error;
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

export async function toggleChannel(
  agentId: string,
  platform: ChannelPlatform,
  isActive: boolean
) {
  ensureSupabase();

  if (isActive) {
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("is_active")
      .eq("id", agentId)
      .single();

    if (agentError) throw agentError;
    if (agent && agent.is_active === false) {
      throw new Error(
        "Cannot enable channel because the agent is inactive. Please activate the agent first."
      );
    }
  }

  const { data: existing, error: fetchError } = await supabase
    .from("agent_channels")
    .select("config")
    .eq("agent_id", agentId)
    .eq("platform", platform)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const config = existing?.config ?? {};
  if (isActive) {
    validateConfig(platform, config);
  }

  const { error } = await supabase
    .from("agent_channels")
    .upsert(
      { agent_id: agentId, platform, is_active: isActive, config },
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
  validateConfig(platform, config);

  const { error } = await supabase
    .from("agent_channels")
    .update({ config })
    .eq("agent_id", agentId)
    .eq("platform", platform);

  if (error) throw error;
}
