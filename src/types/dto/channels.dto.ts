import { type ZodTypeAny } from "zod";

export type AgentChannelStatus = "disconnected" | "pending" | "connected";
export type ChannelPlatform = "webchat" | "whatsapp" | "messenger" | "email";

export interface ChannelDTO {
  id: string;
  workspace_id: string;
  agent_id: string;
  platform: ChannelPlatform;
  config: Record<string, any>; // Using Record<string, any> for flexibility
  is_active: boolean;
  status: AgentChannelStatus;
  created_at: string;
  updated_at: string;
}

export interface UpsertChannelConfigDTO {
  id?: string; // Optional for creation, required for update
  workspace_id: string;
  agent_id: string;
  platform: ChannelPlatform;
  config?: Record<string, any>;
  is_active?: boolean;
  status?: AgentChannelStatus;
}
