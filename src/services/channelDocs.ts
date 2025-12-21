import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export type ChannelDocPayload = {
  doc_id: string;
  channel_key: string;
  version: number;
  lang_code: string;
  title: string;
  content_md: string;
  status: string;
  created_at: string;
};

export async function ensureChannelDoc(workspaceId: string, channelKey: string) {
  if (!supabase || !isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("channel_docs")
    .upsert({ workspace_id: workspaceId, channel_key: channelKey }, { onConflict: "workspace_id,channel_key" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchPublishedChannelDoc(
  workspaceId: string,
  channelKey: string,
  langCode: string
): Promise<ChannelDocPayload | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc("get_published_channel_doc", {
    p_workspace_id: workspaceId,
    p_channel_key: channelKey,
    p_lang_code: langCode,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  return row ?? null;
}

export async function fetchLatestChannelDocVersion(
  workspaceId: string,
  channelKey: string,
  langCode: string
): Promise<ChannelDocPayload | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc("get_channel_doc_version", {
    p_workspace_id: workspaceId,
    p_channel_key: channelKey,
    p_lang_code: langCode,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  return row ?? null;
}
