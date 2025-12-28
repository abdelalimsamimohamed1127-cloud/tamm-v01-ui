// supabase/functions/run_ingestion/handlers/hr_system.ts

import { ConnectorConfig, EmployeeProfile, EmployeeEvent, EmployeeComplaint } from "../../_shared/types.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface IngestionHandlerParams {
  workspace_id: string;
  connector_config: ConnectorConfig;
  ingestion_log_id: string;
  supabaseAdmin: SupabaseClient;
}

export async function handleHrSystemIngestion({
  workspace_id,
  connector_config,
  ingestion_log_id,
  supabaseAdmin,
}: IngestionHandlerParams): Promise<{ processed_count: number; errors: string[] }> {
  const errors: string[] = [];
  let processed_count = 0;

  console.log(`[${ingestion_log_id}] Starting HR System ingestion for workspace: ${workspace_id}`);
  console.log(`[${ingestion_log_id}] Connector Config:`, connector_config);

  // --- Mock fetching data from HR System ---
  // In a real scenario, this would involve:
  // 1. Authenticating with HR system API (e.g., Workday, SAP HR)
  // 2. Fetching employee data, events, and potentially complaints
  // 3. Mapping HR system fields to canonical EmployeeProfile, EmployeeEvent, EmployeeComplaint
  
  const mockHrData = [
    {
      employee_id: "hr001",
      name: "David Lee",
      title: "Senior Engineer",
      dept: "Engineering",
      hire_date: "2020-01-15",
      events: [{ type: "performance_review", date: "2023-06-01", score: 4 }],
      complaints: [],
    },
    {
      employee_id: "hr002",
      name: "Emily White",
      title: "Product Manager",
      dept: "Product",
      hire_date: "2021-03-10",
      events: [{ type: "achievement", date: "2023-09-20", description: "Launched feature X" }],
      complaints: [{ category: "feedback", description: "Long meeting hours", status: "open" }],
    },
  ];

  for (const hrRecord of mockHrData) {
    try {
      // --- Normalize and Upsert into public.employee_profiles ---
      const employeeProfile: EmployeeProfile = {
        workspace_id: workspace_id,
        external_id: hrRecord.employee_id,
        full_name: hrRecord.name,
        role: hrRecord.title,
        department: hrRecord.dept,
        metadata: { hire_date: hrRecord.hire_date },
      };

      const { data: upsertedProfile, error: upsertError } = await supabaseAdmin
        .from("employee_profiles")
        .upsert(employeeProfile, {
          onConflict: "workspace_id, external_id",
          ignoreDuplicates: false,
        })
        .select("id")
        .single();

      if (upsertError) {
        throw new Error(`Failed to upsert employee profile ${hrRecord.employee_id}: ${upsertError.message}`);
      }
      processed_count++;
      console.log(`[${ingestion_log_id}] Upserted employee profile: ${upsertedProfile.id}`);

      // --- Normalize and Insert into public.employee_events ---
      for (const event of hrRecord.events) {
        const employeeEvent: EmployeeEvent = {
          workspace_id: workspace_id,
          employee_id: upsertedProfile.id,
          event_type: event.type,
          payload: { ...event }, // Copy all event data to payload
          occurred_at: new Date(event.date).toISOString(),
        };
        const { error: eventError } = await supabaseAdmin.from("employee_events").insert(employeeEvent);
        if (eventError) {
          errors.push(`Employee ${hrRecord.employee_id} event ${event.type}: ${eventError.message}`);
        } else {
          processed_count++;
        }
      }

      // --- Normalize and Insert into public.employee_complaints ---
      for (const complaint of hrRecord.complaints) {
        const employeeComplaint: EmployeeComplaint = {
          workspace_id: workspace_id,
          employee_id: upsertedProfile.id,
          category: complaint.category,
          description: complaint.description,
          status: complaint.status,
        };
        const { error: complaintError } = await supabaseAdmin.from("employee_complaints").insert(employeeComplaint);
        if (complaintError) {
          errors.push(`Employee ${hrRecord.employee_id} complaint: ${complaintError.message}`);
        } else {
          processed_count++;
        }
      }

    } catch (recordError: any) {
      errors.push(`HR Record ${hrRecord.employee_id}: ${recordError.message}`);
      console.error(`[${ingestion_log_id}] Error processing HR record ${hrRecord.employee_id}: ${recordError.message}`);
    }
  }

  console.log(`[${ingestion_log_id}] Finished HR System ingestion. Processed: ${processed_count}, Errors: ${errors.length}`);
  return { processed_count, errors };
}