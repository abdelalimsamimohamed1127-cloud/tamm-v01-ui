// supabase/functions/run_ingestion/handlers/google_sheets.ts

import { ConnectorConfig, EmployeeProfile, EmployeeEvent } from "../../_shared/types.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface IngestionHandlerParams {
  workspace_id: string;
  connector_config: ConnectorConfig;
  ingestion_log_id: string;
  supabaseAdmin: SupabaseClient;
}

export async function handleGoogleSheetsIngestion({
  workspace_id,
  connector_config,
  ingestion_log_id,
  supabaseAdmin,
}: IngestionHandlerParams): Promise<{ processed_count: number; errors: string[] }> {
  const errors: string[] = [];
  let processed_count = 0;

  console.log(`[${ingestion_log_id}] Starting Google Sheets ingestion for workspace: ${workspace_id}`);
  console.log(`[${ingestion_log_id}] Connector Config:`, connector_config);

  // --- Mock fetching data from Google Sheets ---
  // In a real scenario, this would involve:
  // 1. Authenticating with Google APIs using connector_config (e.g., service account key)
  // 2. Fetching data from the specified sheet_id and range
  // 3. Parsing the sheet data into a structured format

  const mockSheetData = [
    { external_id: "emp001", full_name: "Alice Smith", role: "Manager", department: "Sales", email: "alice@example.com" },
    { external_id: "emp002", full_name: "Bob Johnson", role: "Associate", department: "Sales", email: "bob@example.com" },
    { external_id: "emp003", full_name: "Charlie Brown", role: "Engineer", department: "IT", email: "charlie@example.com" },
  ];

  for (const record of mockSheetData) {
    try {
      // --- Normalize and Upsert into public.employee_profiles ---
      const employeeProfile: EmployeeProfile = {
        workspace_id: workspace_id,
        external_id: record.external_id,
        full_name: record.full_name,
        role: record.role,
        department: record.department,
        metadata: { email: record.email },
      };

      const { data: upsertedProfile, error: upsertError } = await supabaseAdmin
        .from("employee_profiles")
        .upsert(employeeProfile, {
          onConflict: "workspace_id, external_id", // Deduplicate using external_id and workspace_id
          ignoreDuplicates: false,
        })
        .select("id")
        .single();

      if (upsertError) {
        throw new Error(`Failed to upsert employee profile ${record.external_id}: ${upsertError.message}`);
      }

      processed_count++;
      console.log(`[${ingestion_log_id}] Upserted employee profile: ${upsertedProfile.id}`);

      // --- Example: Create a mock event for each employee ---
      const mockEvent: EmployeeEvent = {
        workspace_id: workspace_id,
        employee_id: upsertedProfile.id,
        event_type: "sheet_ingestion_success",
        payload: { source: "google_sheets", processed_at: new Date().toISOString() },
        occurred_at: new Date().toISOString(),
      };

      const { error: eventError } = await supabaseAdmin.from("employee_events").insert(mockEvent);
      if (eventError) {
        throw new Error(`Failed to insert employee event for ${upsertedProfile.id}: ${eventError.message}`);
      }
    } catch (recordError: any) {
      errors.push(`Record ${record.external_id}: ${recordError.message}`);
      console.error(`[${ingestion_log_id}] Error processing record ${record.external_id}: ${recordError.message}`);
    }
  }

  console.log(`[${ingestion_log_id}] Finished Google Sheets ingestion. Processed: ${processed_count}, Errors: ${errors.length}`);
  return { processed_count, errors };
}