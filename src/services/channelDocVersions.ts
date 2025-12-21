import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { ensureChannelDoc, ChannelDocPayload } from "./channelDocs";

export type ChannelDocVersionInput = {
  workspaceId: string;
  channelKey: string;
  langCode: string;
  title: string;
  contentMd: string;
  status: "draft" | "published";
};

async function getDocId(workspaceId: string, channelKey: string) {
  const doc = await ensureChannelDoc(workspaceId, channelKey);
  return doc?.id ?? null;
}

async function getNextVersion(docId: string, langCode: string) {
  if (!supabase || !isSupabaseConfigured) return 1;

  const { data, error } = await supabase
    .from("channel_doc_versions")
    .select("version")
    .eq("doc_id", docId)
    .eq("lang_code", langCode)
    .order("version", { ascending: false })
    .limit(1);

  if (error) throw error;
  const latest = data?.[0]?.version ?? 0;
  return latest + 1;
}

export async function createChannelDocVersion(input: ChannelDocVersionInput): Promise<ChannelDocPayload> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  const docId = await getDocId(input.workspaceId, input.channelKey);
  if (!docId) {
    throw new Error("Unable to find or create channel doc");
  }

  const nextVersion = await getNextVersion(docId, input.langCode);

  const userRes = await supabase.auth.getUser();
  const userId = userRes.data.user?.id ?? null;

  const { data, error } = await supabase
    .from("channel_doc_versions")
    .insert({
      doc_id: docId,
      version: nextVersion,
      lang_code: input.langCode,
      title: input.title,
      content_md: input.contentMd,
      status: input.status,
      created_by: userId,
    })
    .select(
      "doc_id, version, lang_code, title, content_md, status, created_at, channel_docs!inner(channel_key)"
    )
    .single();

  if (error) throw error;

  return {
    doc_id: data.doc_id,
    channel_key: data.channel_docs.channel_key,
    version: data.version,
    lang_code: data.lang_code,
    title: data.title,
    content_md: data.content_md,
    status: data.status,
    created_at: data.created_at,
  };
}

export async function fetchDocVersions(workspaceId: string, channelKey: string, langCode?: string) {
  if (!supabase || !isSupabaseConfigured) return [];

  const doc = await ensureChannelDoc(workspaceId, channelKey);
  if (!doc?.id) return [];

  let query = supabase
    .from("channel_doc_versions")
    .select("id, version, lang_code, title, status, created_at")
    .eq("doc_id", doc.id)
    .order("version", { ascending: false });

  if (langCode) {
    query = query.eq("lang_code", langCode);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
