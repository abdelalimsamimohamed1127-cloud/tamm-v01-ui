// supabase/functions/run_ingestion/handlers/custom_api.ts

import { ConnectorConfig, PolicyDocument } from "../../_shared/types.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface IngestionHandlerParams {
  workspace_id: string;
  connector_config: ConnectorConfig;
  ingestion_log_id: string;
  supabaseAdmin: SupabaseClient;
}

export async function handleCustomApiIngestion({
  workspace_id,
  connector_config,
  ingestion_log_id,
  supabaseAdmin,
}: IngestionHandlerParams): Promise<{ processed_count: number; errors: string[] }> {
  const errors: string[] = [];
  let processed_count = 0;

  console.log(`[${ingestion_log_id}] Starting Custom API ingestion for workspace: ${workspace_id}`);
  console.log(`[${ingestion_log_id}] Connector Config:`, connector_config);

  // --- Mock fetching data from a Custom API ---
  // In a real scenario, this would involve:
  // 1. Making HTTP requests to the URL specified in connector_config.url
  // 2. Handling authentication (e.g., API key, OAuth)
  // 3. Parsing the API response (e.g., JSON)
  // 4. Mapping API response data to canonical entities like PolicyDocument
  
  const mockApiData = [
    { title: "Privacy Policy v1.0", content: "This is our privacy policy...", version: "1.0" },
    { title: "Terms of Service v2.0", content: "These are our terms of service...", version: "2.0" },
  ];

  for (const apiRecord of mockApiData) {
    try {
      // --- Normalize and Upsert into public.policy_documents ---
      const policyDocument: PolicyDocument = {
        workspace_id: workspace_id,
        title: apiRecord.title,
        body: apiRecord.content,
        version: apiRecord.version,
      };

      const { error: upsertError } = await supabaseAdmin
        .from("policy_documents")
        .upsert(policyDocument, {
          onConflict: "workspace_id, title, version", // Deduplicate based on these fields
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw new Error(`Failed to upsert policy document "${apiRecord.title}": ${upsertError.message}`);
      }
      processed_count++;
    } catch (recordError: any) {
      errors.push(`Policy Document "${apiRecord.title}": ${recordError.message}`);
      console.error(`[${ingestion_log_id}] Error processing policy document "${apiRecord.title}": ${recordError.message}`);
    }
  }

  console.log(`[${ingestion_log_id}] Finished Custom API ingestion. Processed: ${processed_count}, Errors: ${errors.length}`);
  return { processed_count, errors };
}