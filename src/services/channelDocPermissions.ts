import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export type ChannelPermission = {
  workspace_id: string;
  channel_key: string;
  role: string;
  can_read: boolean;
  can_write: boolean;
};

export type ChannelLanguagePermission = ChannelPermission & { lang_code: string };

export async function fetchChannelPermissions(workspaceId: string, channelKey: string) {
  if (!supabase || !isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("channel_doc_permissions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("channel_key", channelKey);

  if (error) throw error;
  return data ?? [];
}

export async function upsertChannelPermission(entry: ChannelPermission) {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase not configured");

  const { error } = await supabase.from("channel_doc_permissions").upsert(entry, {
    onConflict: "workspace_id,channel_key,role",
  });
  if (error) throw error;
}

export async function fetchChannelLanguagePermissions(workspaceId: string, channelKey: string) {
  if (!supabase || !isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("channel_doc_language_permissions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("channel_key", channelKey);

  if (error) throw error;
  return data ?? [];
}

export async function upsertChannelLanguagePermission(entry: ChannelLanguagePermission) {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase not configured");

  const { error } = await supabase.from("channel_doc_language_permissions").upsert(entry, {
    onConflict: "workspace_id,channel_key,lang_code,role",
  });
  if (error) throw error;
}
