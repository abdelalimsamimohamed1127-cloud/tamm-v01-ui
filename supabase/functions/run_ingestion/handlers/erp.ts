// supabase/functions/run_ingestion/handlers/erp.ts

import { ConnectorConfig, EmployeeKpi } from "../../_shared/types.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface IngestionHandlerParams {
  workspace_id: string;
  connector_config: ConnectorConfig;
  ingestion_log_id: string;
  supabaseAdmin: SupabaseClient;
}

export async function handleErpIngestion({
  workspace_id,
  connector_config,
  ingestion_log_id,
  supabaseAdmin,
}: IngestionHandlerParams): Promise<{ processed_count: number; errors: string[] }> {
  const errors: string[] = [];
  let processed_count = 0;

  console.log(`[${ingestion_log_id}] Starting ERP ingestion for workspace: ${workspace_id}`);
  console.log(`[${ingestion_log_id}] Connector Config:`, connector_config);

  // --- Mock fetching data from ERP System ---
  // In a real scenario, this would involve:
  // 1. Authenticating with ERP system API
  // 2. Fetching KPI data, financial metrics, etc.
  // 3. Mapping ERP fields to canonical EmployeeKpi
  
  const mockErpData = [
    { external_employee_id: "emp001", kpi: "sales_target_achieved", value: 0.95, period_start: "2023-01-01", period_end: "2023-03-31" },
    { external_employee_id: "emp002", kpi: "customer_satisfaction", value: 4.2, period_start: "2023-01-01", period_end: "2023-03-31" },
    { external_employee_id: "emp001", kpi: "project_completion_rate", value: 0.88, period_start: "2023-01-01", period_end: "2023-03-31" },
  ];

  for (const erpRecord of mockErpData) {
    try {
      // Find the employee_id from employee_profiles using external_employee_id and workspace_id
      const { data: employee, error: employeeError } = await supabaseAdmin
        .from("employee_profiles")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("external_id", erpRecord.external_employee_id)
        .single();

      if (employeeError || !employee) {
        throw new Error(`Employee profile not found for external_id: ${erpRecord.external_employee_id}`);
      }

      // --- Normalize and Upsert into public.employee_kpis ---
      const employeeKpi: EmployeeKpi = {
        workspace_id: workspace_id,
        employee_id: employee.id,
        kpi_key: erpRecord.kpi,
        kpi_value: erpRecord.value,
        period_start: erpRecord.period_start,
        period_end: erpRecord.period_end,
      };

      const { error: upsertError } = await supabaseAdmin
        .from("employee_kpis")
        .upsert(employeeKpi, {
          onConflict: "workspace_id, employee_id, kpi_key, period_start", // Deduplicate based on these fields
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw new Error(`Failed to upsert employee KPI ${erpRecord.kpi} for employee ${erpRecord.external_employee_id}: ${upsertError.message}`);
      }
      processed_count++;
    } catch (recordError: any) {
      errors.push(`ERP Record ${erpRecord.external_employee_id} - ${erpRecord.kpi}: ${recordError.message}`);
      console.error(`[${ingestion_log_id}] Error processing ERP record ${erpRecord.external_employee_id}: ${recordError.message}`);
    }
  }

  console.log(`[${ingestion_log_id}] Finished ERP ingestion. Processed: ${processed_count}, Errors: ${errors.length}`);
  return { processed_count, errors };
}