import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from "../_shared/supabase.ts";
import { getProvider } from "../_shared/llm.ts";

type Body = { workspace_id: string };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.workspace_id) return jsonResponse({ error: "Missing workspace_id" }, 400);

    const supabase = getSupabaseAdmin();
    const userId = await getAuthUserId(req);
    if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

    const ok = await assertWorkspaceMember({ supabase, workspaceId: body.workspace_id, userId });
    if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders } = await supabase
      .from("orders")
      .select("status,total,created_at,items")
      .eq("workspace_id", body.workspace_id)
      .gte("created_at", since);

    const { data: tickets } = await supabase
      .from("tickets")
      .select("status,priority,category,created_at")
      .eq("workspace_id", body.workspace_id)
      .gte("created_at", since);

    const { data: cost } = await supabase
      .from("cost_events")
      .select("cost_usd,input_tokens,output_tokens,created_at")
      .eq("workspace_id", body.workspace_id)
      .gte("created_at", since);

    const snapshot = {
      period_days: 7,
      orders: orders ?? [],
      tickets: tickets ?? [],
      cost_events: cost ?? [],
    };

    const provider = getProvider();

    const sys = `You are an analytics copilot for a social commerce SaaS.
Return ONLY JSON:
{
  "summary": string,
  "sales": {"orders": number, "revenue_estimate": number|null, "tips": string[]},
  "support": {"tickets": number, "top_categories": string[], "tips": string[]},
  "ai_cost": {"cost_usd": number|null, "tokens_in": number, "tokens_out": number, "tips": string[]},
  "next_actions": string[]
}
Keep it concise.`;

    const out = await provider.chat(
      [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(snapshot) },
      ],
      { temperature: 0.2, maxTokens: 600 },
    );

    let report: any = {};
    try {
      report = JSON.parse(String(out).trim().replace(/^```json/i, "").replace(/```$/i, ""));
    } catch {
      report = { summary: String(out).slice(0, 1200) };
    }

    const yyyymm = new Date().toISOString().slice(0, 7).replace("-", "");
    const title = `Weekly Insights (${yyyymm})`;

    await supabase.from("insight_reports").insert({
      workspace_id: body.workspace_id,
      period_yyyymm: yyyymm,
      title,
      report,
    });

    return jsonResponse({ ok: true, title, report }, 200);
  } catch (e) {
    return jsonResponse({ error: String((e as any)?.message ?? e) }, 500);
  }
});
