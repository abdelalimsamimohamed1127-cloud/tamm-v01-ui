import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { ensureChannelDoc } from "./channelDocs";

export type ChannelDocLanguage = {
  channel_doc_id: string;
  lang_code: string;
};

export async function fetchChannelDocLanguages(workspaceId: string, channelKey: string) {
  if (!supabase || !isSupabaseConfigured) return [];

  const doc = await ensureChannelDoc(workspaceId, channelKey);
  if (!doc?.id) return [];

  const { data, error } = await supabase
    .from("channel_doc_languages")
    .select("*")
    .eq("channel_doc_id", doc.id);

  if (error) throw error;
  return data ?? [];
}

export async function addChannelDocLanguage(workspaceId: string, channelKey: string, langCode: string) {
  if (!supabase || !isSupabaseConfigured) throw new Error("Supabase not configured");

  const doc = await ensureChannelDoc(workspaceId, channelKey);
  if (!doc?.id) throw new Error("Unable to find or create doc");

  const { error } = await supabase.from("channel_doc_languages").upsert(
    {
      channel_doc_id: doc.id,
      lang_code: langCode,
    },
    { onConflict: "channel_doc_id,lang_code" }
  );

  if (error) throw error;
}
