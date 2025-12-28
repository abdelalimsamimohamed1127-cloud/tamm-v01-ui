import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/apiClient"; // Import apiFetch
import { getAuthToken } from "@/lib/utils"; // Assuming a utility to get auth token

export type KnowledgeSourceType = "file" | "url" | "manual" | "qna"; // Updated types

export type KnowledgeSource = {
  id: string;
  workspace_id: string;
  agent_id: string;
  type: KnowledgeSourceType;
  title: string;
  status: string; // Add status to track ingestion
  created_at: string;
};

export type KnowledgeSourcePayload = {
  workspace_id: string;
  agent_id: string;
  type: KnowledgeSourceType;
  title: string;
  payload: Record<string, any>; // Add payload for source-specific data
};

export async function createKnowledgeSource(payload: KnowledgeSourcePayload): Promise<KnowledgeSource> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from("agent_sources") // Changed to agent_sources
    .insert({
      workspace_id: payload.workspace_id,
      agent_id: payload.agent_id,
      type: payload.type,
      title: payload.title,
      payload: payload.payload,
      status: "uploaded" // Initial status
    })
    .select()
    .single();

  if (error) throw error;

  const newSource = data as KnowledgeSource;

  // Trigger backend ingestion
  const authToken = await getAuthToken(); // Assuming getAuthToken exists and retrieves the JWT
  if (!authToken) {
    throw new Error("Authentication token not found.");
  }

  const ingestResponse = await apiFetch(
    "/api/v1/knowledge/ingest",
    {
      method: "POST",
      body: JSON.stringify({
        source_id: newSource.id,
        agent_id: newSource.agent_id,
      }),
    },
    authToken
  );

  if (ingestResponse.error) {
    // Optionally update source status to 'failed' if ingestion trigger fails
    await supabase.from("agent_sources").update({ status: "failed" }).eq("id", newSource.id);
    throw new Error(`Failed to trigger ingestion: ${ingestResponse.error}`);
  }

  return newSource;
}

export async function getKnowledgeSourcesForAgent(agentId: string): Promise<KnowledgeSource[]> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from("agent_sources") // Changed to agent_sources
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as KnowledgeSource[];
}

const KNOWLEDGE_FILES_BUCKET = "agent_files"; // Define the bucket name

export async function uploadFileToStorage(file: File, agentId: string, workspaceId: string): Promise<string> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured");
  }

  const filePath = `${workspaceId}/${agentId}/${file.name}`; // Example path structure

  const { data, error } = await supabase.storage
    .from(KNOWLEDGE_FILES_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return data.path; // Return the path to the uploaded file
}


export async function deleteKnowledgeSource(sourceId: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured");
  }

  // Before deleting the source, ideally, trigger a backend job to remove
  // the file from storage and associated chunks/embeddings if not handled by RLS cascade delete.
  // For this task, we assume RLS or backend will handle cleanup of associated data.
  const { error } = await supabase
    .from("agent_sources")
    .delete()
    .eq("id", sourceId);

  if (error) {
    throw new Error(`Failed to delete knowledge source: ${error.message}`);
  }
}
