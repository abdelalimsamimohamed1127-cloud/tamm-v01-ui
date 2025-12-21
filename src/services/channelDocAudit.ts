import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export type ChannelDocAudit = {
  id: string;
  user_id: string | null;
  workspace_id: string;
  channel_key: string;
  lang_code: string | null;
  action: "read" | "draft" | "publish";
  created_at: string;
};

export async function fetchChannelDocAuditLogs(workspaceId: string, channelKey?: string, limit = 20) {
  if (!supabase || !isSupabaseConfigured) return [];

  let query = supabase
    .from("channel_doc_audit_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (channelKey) {
    query = query.eq("channel_key", channelKey);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
