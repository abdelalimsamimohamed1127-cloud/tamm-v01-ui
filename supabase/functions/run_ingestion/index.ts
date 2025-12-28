// supabase/functions/run_ingestion/index.ts

import { jsonResponse, captureError } from "../_shared/observability.ts";
import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { ConnectorConfig } from "../_shared/types.ts"; // Assuming this type exists or will be created

// Import specific handlers (these files will be created next)
import { handleGoogleSheetsIngestion } from "./handlers/google_sheets.ts";
import { handleHrSystemIngestion } from "./handlers/hr_system.ts";
import { handleErpIngestion } from "./handlers/erp.ts";
import { handleCustomApiIngestion } from "./handlers/custom_api.ts";

// Define the contract for an ingestion handler
interface IngestionHandler {
  (params: {
    workspace_id: string;
    connector_config: ConnectorConfig;
    ingestion_log_id: string;
    supabaseAdmin: any; // Pass the Supabase admin client
  }): Promise<{ processed_count: number; errors: string[] }>;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ message: "Method Not Allowed" }, { status: 405 });
  }

  let connectorId: string;
  let workspaceId: string;
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { connector_id } = await req.json();
    if (!connector_id) {
      return jsonResponse({ error: "Missing connector_id" }, { status: 400 });
    }
    connectorId = connector_id;

    // Load connector row
    const { data: connector, error: connectorError } = await supabaseAdmin
      .from("connectors")
      .select("workspace_id, type, name, config, status")
      .eq("id", connectorId)
      .single();

    if (connectorError) {
      console.error("Failed to load connector:", connectorError.message);
      return jsonResponse({ error: "Connector not found or database error" }, { status: 404 });
    }
    if (!connector) {
      return jsonResponse({ error: "Connector not found" }, { status: 404 });
    }

    workspaceId = connector.workspace_id; // Derive workspace_id from connector (trusted source)

    // Validate connector.status = 'active'
    if (connector.status !== "active") {
      return jsonResponse({ error: `Connector is not active (status: ${connector.status})` }, { status: 400 });
    }

    // Create ingestion_logs row (status = 'running')
    const { data: ingestionLog, error: logError } = await supabaseAdmin
      .from("ingestion_logs")
      .insert({
        workspace_id: workspaceId,
        connector_id: connectorId,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (logError) {
      console.error("Failed to create ingestion log:", logError.message);
      return jsonResponse({ error: "Failed to initialize ingestion log" }, { status: 500 });
    }
    const ingestionLogId = ingestionLog.id;

    let processedCount = 0;
    let errors: string[] = [];
    let ingestionStatus: "success" | "partial" | "failed" = "failed";

    try {
      let handler: IngestionHandler;
      switch (connector.type) {
        case "google_sheets":
          handler = handleGoogleSheetsIngestion;
          break;
        case "hr_system":
          handler = handleHrSystemIngestion;
          break;
        case "erp":
          handler = handleErpIngestion;
          break;
        case "custom_api":
          handler = handleCustomApiIngestion;
          break;
        default:
          throw new Error(`Unsupported connector type: ${connector.type}`);
      }

      const handlerResult = await handler({
        workspace_id: workspaceId,
        connector_config: connector.config,
        ingestion_log_id: ingestionLogId,
        supabaseAdmin: supabaseAdmin,
      });

      processedCount = handlerResult.processed_count;
      errors = handlerResult.errors;

      if (errors.length === 0 && processedCount > 0) {
        ingestionStatus = "success";
      } else if (errors.length > 0 && processedCount > 0) {
        ingestionStatus = "partial";
      } else {
        ingestionStatus = "failed"; // No records processed or only errors
      }
    } catch (handlerError: any) {
      console.error(`Handler for ${connector.type} failed:`, handlerError.message);
      errors.push(`Handler error: ${handlerError.message}`);
      ingestionStatus = "failed";
    } finally {
      // Update ingestion_logs
      const { error: updateLogError } = await supabaseAdmin
        .from("ingestion_logs")
        .update({
          status: ingestionStatus,
          records_processed: processedCount,
          error_summary: errors.join("; ").substring(0, 1000), // Truncate summary
          finished_at: new Date().toISOString(),
        })
        .eq("id", ingestionLogId);

      if (updateLogError) {
        console.error("Failed to update ingestion log:", updateLogError.message);
        captureError({ where: "run_ingestion_final_log_update", error: updateLogError });
      }
    }

    if (ingestionStatus === "failed" || ingestionStatus === "partial") {
      return jsonResponse({
        message: `Ingestion finished with status: ${ingestionStatus}`,
        processed_count: processedCount,
        errors: errors,
      }, { status: 200 });
    }

    return jsonResponse({ message: "Ingestion completed successfully", processed_count: processedCount });
  } catch (error: any) {
    console.error("Unhandled error in run_ingestion:", error.message);
    captureError({ where: "run_ingestion_unhandled", error });
    return jsonResponse({ error: "Internal Server Error" }, { status: 500 });
  }
}
