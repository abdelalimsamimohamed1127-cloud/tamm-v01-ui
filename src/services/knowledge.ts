import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

export type KnowledgeStatus = "uploaded" | "processing" | "ready" | "failed";

const KNOWLEDGE_STATUS_TRANSITIONS: Record<KnowledgeStatus, KnowledgeStatus[]> = {
  uploaded: ["processing"],
  processing: ["ready", "failed"],
  ready: [],
  failed: [],
};

function isKnowledgeStatus(value: string): value is KnowledgeStatus {
  return ["uploaded", "processing", "ready", "failed"].includes(value);
}

export function assertValidKnowledgeTransition(from: KnowledgeStatus, to: KnowledgeStatus) {
  const allowed = KNOWLEDGE_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid knowledge status transition from ${from} to ${to}`);
  }
}

async function fetchCurrentKnowledgeStatus(sourceId: string): Promise<KnowledgeStatus> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  const { data, error } = await supabase.from("knowledge_sources").select("status").eq("id", sourceId).single();

  if (error) {
    throw error;
  }

  const status = data?.status;
  if (!status || !isKnowledgeStatus(status)) {
    throw new Error(`Unknown knowledge status: ${status}`);
  }

  return status;
}

async function updateKnowledgeStatus(sourceId: string, nextStatus: KnowledgeStatus, errorReason?: string) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }

  const currentStatus = await fetchCurrentKnowledgeStatus(sourceId);
  assertValidKnowledgeTransition(currentStatus, nextStatus);

  const { error } = await supabase
    .from("knowledge_sources")
    .update({ status: nextStatus, error: nextStatus === "failed" ? errorReason ?? null : null })
    .eq("id", sourceId)
    .select("id")
    .single();

  if (error) {
    throw error;
  }
}

export async function markKnowledgeProcessing(sourceId: string) {
  await updateKnowledgeStatus(sourceId, "processing");
}

export async function markKnowledgeReady(sourceId: string) {
  await updateKnowledgeStatus(sourceId, "ready");
}

export async function markKnowledgeFailed(sourceId: string, reason?: string) {
  await updateKnowledgeStatus(sourceId, "failed", reason);
}
