import { supabase } from "@/integrations/supabase/client";

export interface AgentUsage {
  workspace_id: string;
  agent_id: string;
  agent_name: string;
  usage_events: number;
  credits_used: number;
  first_usage_at: string;
  last_usage_at: string;
}

export interface ChannelUsage {
  workspace_id: string;
  channel: string;
  events_count: number;
  credits_used: number;
}

export interface DailyCreditBurn {
  workspace_id: string;
  day: string;
  credits_used: number;
}

export async function getAgentUsage(workspaceId: string): Promise<AgentUsage[]> {
  const { data, error } = await supabase
    .from("agent_usage_stats")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("credits_used", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AgentUsage[];
}

export async function getChannelUsage(workspaceId: string): Promise<ChannelUsage[]> {
  const { data, error } = await supabase
    .from("channel_usage_stats")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("credits_used", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ChannelUsage[];
}

export async function getDailyBurn(
  workspaceId: string,
  days = 30
): Promise<DailyCreditBurn[]> {
  const { data, error } = await supabase
    .from("daily_credit_burn")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("day", { ascending: false })
    .limit(days);

  if (error) throw error;
  return (data ?? []) as DailyCreditBurn[];
}
