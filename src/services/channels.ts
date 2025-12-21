import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { getAgentForWorkspace } from "@/lib/agent";
import type { Tables } from "@/integrations/supabase/types";

type Channel = Tables<"channels">;

export async function enableChannel(workspaceId: string, channelType: Channel["type"], metadata?: Channel["metadata"]) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  const agent = await getAgentForWorkspace(workspaceId);

  if (!agent || agent.status !== "active" || agent.is_active === false) {
    throw new Error("Agent must be active to enable channels");
  }

  const { data, error } = await supabase
    .from("channels")
    .upsert(
      {
        workspace_id: workspaceId,
        type: channelType,
        status: "active",
        metadata: metadata ?? null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,type" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as Channel;
}

export async function disableChannel(workspaceId: string, channelType: Channel["type"]) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  const { data, error } = await supabase
    .from("channels")
    .update({ status: "disabled" })
    .eq("workspace_id", workspaceId)
    .eq("type", channelType)
    .select("*")
    .single();

  if (error) throw error;
  return data as Channel;
}
