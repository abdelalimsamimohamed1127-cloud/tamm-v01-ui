import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getProvider } from "../_shared/llm.ts";
import { DateTime, Settings as LuxonSettings } from "https://esm.sh/luxon@3.4.4"; // For robust date handling
import { v4 as uuidv4 } from "https://deno.land/std@0.97.0/uuid/v4.ts"; // For generating UUIDs

// Set Luxon to use UTC by default
LuxonSettings.defaultZone = "utc";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Use service role key

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Initialize Supabase with service role
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // This function is intended to be called by Supabase CRON.
  // It will not have a user-authenticated context, but run with service role privileges.
  console.log(`[WeeklyInsightsJob] Job started at ${new Date().toISOString()}`);
  let jobStatus = "success";
  const processedWorkspaces: string[] = [];
  const failedWorkspaces: { id: string; error: string }[] = [];

  try {
    // 1. Fetch active workspaces
    const { data: workspaces, error: workspacesError } = await supabase
      .from("workspaces")
      .select("id, created_at")
      .eq("is_active", true);

    if (workspacesError) {
      console.error("[WeeklyInsightsJob] Error fetching active workspaces:", workspacesError);
      throw new Error("Failed to fetch active workspaces.");
    }
    if (!workspaces || workspaces.length === 0) {
      console.log("[WeeklyInsightsJob] No active workspaces found. Exiting.");
      return jsonResponse({ message: "No active workspaces to process." }, 200);
    }

    // Compute the last full week range (Monday to Sunday)
    const today = DateTime.utc();
    const endOfLastWeek = today.startOf("week").minus({ days: 1 }); // Sunday of last week
    const startOfLastWeek = endOfLastWeek.minus({ days: 6 }); // Monday of last week

    const periodStart = startOfLastWeek.toISODate(); // YYYY-MM-DD
    const periodEnd = endOfLastWeek.toISODate(); // YYYY-MM-DD
    const periodKey = `${startOfLastWeek.toFormat('yyyy-MM-dd')}_${endOfLastWeek.toFormat('yyyy-MM-dd')}`;


    console.log(`[WeeklyInsightsJob] Processing ${workspaces.length} workspaces for week: ${periodStart} to ${periodEnd}`);

    for (const workspace of workspaces) {
      try {
        console.log(`[WeeklyInsightsJob] Processing workspace: ${workspace.id}`);

        // 2. Idempotency Check: Check if insights already exist for this period
        const { data: existingInsight, error: insightError } = await supabase
          .from("analytics_insights") // Use analytics_insights as per task
          .select("id")
          .eq("workspace_id", workspace.id)
          .eq("period_key", periodKey) // Use a period_key for idempotency
          .limit(1)
          .single();

        if (existingInsight) {
          console.log(`[WeeklyInsightsJob] Insight already exists for workspace ${workspace.id} for period ${periodKey}. Skipping.`);
          processedWorkspaces.push(`${workspace.id} (skipped-existing)`);
          continue; // Skip to next workspace
        }

        // 3. Insight Generation Logic (reusing/adapting from previous logic)
        // Fetch data required for insights (orders, tickets, cost_events for the week)
        const { data: orders } = await supabase
          .from("orders")
          .select("status,total,created_at,items")
          .eq("workspace_id", workspace.id)
          .gte("created_at", periodStart)
          .lte("created_at", periodEnd);

        const { data: tickets } = await supabase
          .from("tickets")
          .select("status,priority,category,created_at")
          .eq("workspace_id", workspace.id)
          .gte("created_at", periodStart)
          .lte("created_at", periodEnd);

        const { data: cost } = await supabase
          .from("cost_events") // Assuming a cost_events table for tracking AI usage cost
          .select("cost_usd,input_tokens,output_tokens,created_at")
          .eq("workspace_id", workspace.id)
          .gte("created_at", periodStart)
          .lte("created_at", periodEnd);

        const snapshot = {
          period_start: periodStart,
          period_end: periodEnd,
          orders: orders ?? [],
          tickets: tickets ?? [],
          cost_events: cost ?? [],
        };

        const provider = getProvider(); // Assuming getProvider initializes LLM client

        const sys = `You are an analytics copilot for a social commerce SaaS.
        Analyze the provided snapshot of a workspace's weekly data (orders, tickets, AI costs).
        Return ONLY JSON:
        {
          "summary": string,
          "sales": {"orders": number, "revenue_estimate": number|null, "tips": string[]},
          "support": {"tickets": number, "top_categories": string[], "tips": string[]},
          "ai_cost": {"cost_usd": number|null, "tokens_in": number, "tokens_out": number, "tips": string[]},
          "next_actions": string[]
        }
        Keep it concise. If data is insufficient for any section, state it in the summary or tips.`;

        const out = await provider.chat(
          [
            {"role": "system", "content": sys},
            {"role": "user", "content": JSON.stringify(snapshot)},
          ],
          { temperature: 0.2, maxTokens: 800 }, // Increased maxTokens for more comprehensive insights
        );

        let reportContent: any = {};
        try {
          reportContent = JSON.parse(String(out).trim().replace(/^```json/i, "").replace(/```$/i, ""));
        } catch (jsonErr) {
          console.error(`[WeeklyInsightsJob] JSON parsing failed for workspace ${workspace.id}:`, jsonErr);
          // Fallback to plain text summary if JSON parsing fails
          reportContent = { summary: String(out).slice(0, 1500) }; 
        }

        // 4. Store in analytics_insights table
        const { error: insertError } = await supabase
          .from("analytics_insights")
          .insert({
            workspace_id: workspace.id,
            period_key: periodKey,
            period_start: periodStart,
            period_end: periodEnd,
            insight_type: "weekly_summary",
            content: reportContent, // Store the generated report content
          });

        if (insertError) {
          console.error(`[WeeklyInsightsJob] Error storing insight for workspace ${workspace.id}:`, insertError);
          throw new Error("Failed to store insight.");
        }

        console.log(`[WeeklyInsightsJob] Successfully generated and stored insight for workspace ${workspace.id}.`);
        processedWorkspaces.push(workspace.id);

      } catch (workspaceError: any) {
        console.error(`[WeeklyInsightsJob] Failed to process workspace ${workspace.id}:`, workspaceError.message);
        failedWorkspaces.push({ id: workspace.id, error: workspaceError.message });
        jobStatus = "partial_failure"; // Mark job as partial failure if any workspace fails
      }
    }

    console.log(`[WeeklyInsightsJob] Job finished. Status: ${jobStatus}`);
    console.log(`[WeeklyInsightsJob] Processed Workspaces: ${processedWorkspaces.join(', ')}`);
    if (failedWorkspaces.length > 0) {
      console.log(`[WeeklyInsightsJob] Failed Workspaces: ${JSON.stringify(failedWorkspaces)}`);
    }

    return jsonResponse({
      job_status: jobStatus,
      processed_workspaces: processedWorkspaces,
      failed_workspaces: failedWorkspaces,
    }, jobStatus === "success" ? 200 : 500);

  } catch (globalError: any) {
    console.error("[WeeklyInsightsJob] Global job failure:", globalError);
    return jsonResponse({
      job_status: "global_failure",
      error: globalError.message,
    }, 500);
  }
});

