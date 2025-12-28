import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DateTime, Settings as LuxonSettings } from "https://esm.sh/luxon@3.4.4"; // For robust date handling

// Set Luxon to use UTC by default
LuxonSettings.defaultZone = "utc";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Use service role key

// Configuration for cleanup
const RETENTION_DAYS_EXTERNAL_EVENTS = 30; // Example: Keep external events for 30 days
const RETENTION_DAYS_INGESTION_LOGS = 30;  // Example: Keep ingestion logs for 30 days
const BATCH_SIZE = 1000; // Number of records to delete per batch to avoid long locks

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  console.log(`[RetentionCleanupJob] Job started at ${new Date().toISOString()}`);
  const jobStartTime = Date.now();
  let jobStatus = "success";
  const results: { target: string; status: string; records_processed: number; error?: string }[] = [];

  try {
    // 1. Clean up old external_events
    const externalEventsResult = await cleanupTable(
      supabase,
      "external_events",
      "created_at",
      RETENTION_DAYS_EXTERNAL_EVENTS,
      BATCH_SIZE,
      "External Events"
    );
    results.push(externalEventsResult);
    if (externalEventsResult.status !== "success") jobStatus = "partial_failure";

    // 2. Clean up old ingestion_logs
    const ingestionLogsResult = await cleanupTable(
      supabase,
      "ingestion_logs",
      "created_at",
      RETENTION_DAYS_INGESTION_LOGS,
      BATCH_SIZE,
      "Ingestion Logs"
    );
    results.push(ingestionLogsResult);
    if (ingestionLogsResult.status !== "success") jobStatus = "partial_failure";

    // Add other cleanup targets here following the same pattern

    console.log(`[RetentionCleanupJob] Job finished. Status: ${jobStatus}`);
    console.log(`[RetentionCleanupJob] Results: ${JSON.stringify(results, null, 2)}`);

    return jsonResponse({
      job_status: jobStatus,
      duration_ms: Date.now() - jobStartTime,
      results,
    }, jobStatus === "success" ? 200 : 500);

  } catch (globalError: any) {
    console.error("[RetentionCleanupJob] Global job failure:", globalError);
    return jsonResponse({
      job_status: "global_failure",
      error: globalError.message,
    }, 500);
  }
});

async function cleanupTable(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
  dateColumn: string,
  retentionDays: number,
  batchSize: number,
  logName: string
): Promise<{ target: string; status: string; records_processed: number; error?: string }> {
  let recordsProcessed = 0;
  let status = "success";
  let errorMsg: string | undefined;

  console.log(`[RetentionCleanupJob] Starting cleanup for ${logName} (table: ${tableName})`);

  try {
    const cutoffDate = DateTime.utc().minus({ days: retentionDays }).toISO();
    
    // Loop to delete in batches
    while (true) {
      // Select IDs of records to delete, limiting to batchSize
      const { data: recordsToDelete, error: selectError } = await supabase
        .from(tableName)
        .select("id")
        .lte(dateColumn, cutoffDate)
        .limit(batchSize);

      if (selectError) {
        throw new Error(`Failed to select records for deletion: ${selectError.message}`);
      }

      if (!recordsToDelete || recordsToDelete.length === 0) {
        console.log(`[RetentionCleanupJob] No more records to delete from ${logName}.`);
        break; // Exit loop if no records found
      }

      const idsToDelete = recordsToDelete.map(r => r.id);

      // Delete the selected batch
      const { count, error: deleteError } = await supabase
        .from(tableName)
        .delete({ count: "exact" }) // Request exact count of deleted rows
        .in("id", idsToDelete);

      if (deleteError) {
        throw new Error(`Failed to delete batch from ${logName}: ${deleteError.message}`);
      }

      recordsProcessed += count || 0;
      console.log(`[RetentionCleanupJob] Deleted ${count} records from ${logName}. Total processed: ${recordsProcessed}`);

      if (count === 0 || count < batchSize) { // If less than batch size, likely no more records
        break; 
      }
    }
    console.log(`[RetentionCleanupJob] Finished cleanup for ${logName}. Total records processed: ${recordsProcessed}`);

  } catch (e: any) {
    status = "failed";
    errorMsg = e.message;
    console.error(`[RetentionCleanupJob] Error during cleanup for ${logName}:`, e.message);
  }

  return { target: tableName, status, records_processed: recordsProcessed, error: errorMsg };
}