import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

type KnowledgeSourceStatus = "uploaded" | "failed" | "processing" | "ready" | string;

async function fetchKnowledgeSource(sourceId: string) {
  const { data, error } = await supabase!
    .from("knowledge_sources")
    .select("id, status")
    .eq("id", sourceId)
    .single();

  if (error) {
    throw new Error(error.message || "Failed to fetch knowledge source.");
  }

  if (!data) {
    throw new Error("Knowledge source not found.");
  }

  return data as { id: string; status: KnowledgeSourceStatus };
}

async function assertNoChunksExist(sourceId: string) {
  const { count, error } = await supabase!
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId);

  if (error) {
    throw new Error(error.message || "Failed to verify knowledge chunks.");
  }

  if ((count ?? 0) > 0) {
    throw new Error("Cannot delete knowledge source because chunks exist for this source.");
  }
}

export async function deleteKnowledgeSource(sourceId: string) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase client is not configured.");
  }

  const source = await fetchKnowledgeSource(sourceId);

  const allowedStatuses: KnowledgeSourceStatus[] = ["uploaded", "failed"];
  if (!allowedStatuses.includes(source.status)) {
    throw new Error(`Knowledge source cannot be deleted while status is "${source.status}".`);
  }

  await assertNoChunksExist(sourceId);

  const { error } = await supabase.from("knowledge_sources").delete().eq("id", sourceId);
  if (error) {
    throw new Error(error.message || "Failed to delete knowledge source.");
  }
}
