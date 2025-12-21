// EDGE FUNCTION: run_agent (RAG + reply + extraction + traces) - ZIP12 merged
import { serve } from "https://deno.land/std/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from "../_shared/supabase.ts";
import { getProvider, type ChatMessage } from "../_shared/llm.ts";
import { bumpUsageCounters } from "../_shared/usage.ts";

type Body = {
  workspace_id: string;
  channel_id: string;
  conversation_id: string;
  agent_id: string;
  intent?: "sales" | "support" | "unknown";
  last_user_text?: string;
  mode?: "reply" | "draft";
};

const HANDOFF_PATTERNS: RegExp[] = [
  /تحدث\s+مع\s+(فرد|حد|موظف|إنسان|بشر)/i,
  /كلم(ني|نا)\s+(بشر|انسان|موظف)/i,
  /talk to (a )?human/i,
  /human agent/i,
];

function shouldHandoff(userText: string) {
  return HANDOFF_PATTERNS.some((r) => r.test(userText));
}

function roughTokens(text: string) {
  return Math.max(1, Math.ceil((text?.length ?? 0) / 4));
}

async function extractOrder(provider: any, text: string) {
  const sys = `Extract an order from the conversation.
Return ONLY valid JSON:
{"customer_name":string|null,"phone":string|null,"address":string|null,"items":[{"name":string,"qty":number,"price":number|null}],"total":number|null,"has_order":boolean}`;
  const out = await provider.chat(
    [
      { role: "system", content: sys },
      { role: "user", content: text },
    ],
    { temperature: 0, maxTokens: 400 },
  );
  try {
    const j = JSON.parse(String(out).trim().replace(/^```json/i, "").replace(/```$/i, ""));
    if (j?.has_order) return j;
  } catch {
    // ignore
  }
  return null;
}

async function extractTicket(provider: any, text: string) {
  const sys = `Extract a support ticket from the conversation.
Return ONLY valid JSON:
{"category":"delivery"|"refund"|"quality"|"other"|null,"priority":"low"|"medium"|"high"|null,"notes":string|null,"has_ticket":boolean}`;
  const out = await provider.chat(
    [
      { role: "system", content: sys },
      { role: "user", content: text },
    ],
    { temperature: 0, maxTokens: 300 },
  );
  try {
    const j = JSON.parse(String(out).trim().replace(/^```json/i, "").replace(/```$/i, ""));
    if (j?.has_ticket) return j;
  } catch {
    // ignore
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();

  try {
    const body = (await req.json()) as Body;
    const { workspace_id, channel_id, conversation_id, agent_id } = body ?? ({} as any);
    const mode = body.mode ?? "reply";

    if (!workspace_id || !channel_id || !conversation_id || !agent_id) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const supabase = getSupabaseAdmin();
    const userId = await getAuthUserId(req);
    if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

    const ok = await assertWorkspaceMember({ supabase, workspaceId: workspace_id, userId });
    if (!ok) return jsonResponse({ error: "Forbidden" }, 403);

    const { data: conv } = await supabase
      .from("conversations")
      .select("id,status")
      .eq("id", conversation_id)
      .maybeSingle();

    if (!conv) return jsonResponse({ error: "Conversation not found" }, 404);
    if (String(conv.status) === "handoff" && mode !== "draft") {
      return jsonResponse({ handoff: true, reply: null }, 200);
    }

    const provider = getProvider();

    const { data: agent } = await supabase.from("agents").select("*").eq("id", agent_id).maybeSingle();
    if (!agent) return jsonResponse({ error: "Agent not found" }, 404);

    const { data: msgs } = await supabase
      .from("channel_messages")
      .select("sender_type,message_text,created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(40);

    const lastUserText =
      body.last_user_text ??
      [...(msgs ?? [])].reverse().find((m: any) => m.sender_type === "customer")?.message_text ??
      "";

    if (mode === "reply" && agent.human_handoff_enabled && shouldHandoff(lastUserText)) {
      await supabase
        .from("conversations")
        .update({ status: "handoff", handoff_reason: "customer_request", handoff_requested_at: new Date().toISOString() })
        .eq("id", conversation_id);
      return jsonResponse({ handoff: true, reply: "تم. هيوصلك حد من الفريق حالًا ✅", conversation_id }, 200);
    }

    const history: ChatMessage[] = (msgs ?? []).map((m: any) => ({
      role: m.sender_type === "customer" ? "user" : "assistant",
      content: m.message_text,
    }));

    // RAG retrieval
    let contextText = "";
    let citations: any[] = [];
    let confidence = 0.25;
    let retrievedIds: string[] = [];
    let rerankScores: any[] = [];

    try {
      const [embedding] = await provider.embed([lastUserText]);

      const { data: vecRows } = await supabase.rpc("match_knowledge_embeddings", {
        query_embedding: embedding,
        match_count: 10,
        workspace_id: workspace_id,
        agent_id: agent_id,
      });

      const rows = vecRows ?? [];
      retrievedIds = rows.map((r: any) => String(r.chunk_id));
      rerankScores = rows.map((r: any) => ({ chunk_id: r.chunk_id, similarity: r.similarity }));
      const top3 = rows.slice(0, 3);
      const avg = top3.length ? top3.reduce((s: number, r: any) => s + Number(r.similarity ?? 0), 0) / top3.length : 0.2;
      confidence = Math.max(0, Math.min(1, avg));

      contextText = rows
        .slice(0, 6)
        .map((r: any, i: number) => `[${i + 1}] ${r.content}\nSOURCE: ${r.title ?? ""}`)
        .join("\n\n");

      citations = rows.slice(0, 6).map((r: any, i: number) => ({
        n: i + 1,
        chunk_id: r.chunk_id,
        source_id: r.source_id,
        title: r.title,
      }));
    } catch {
      // ignore
    }

    const sysParts: string[] = [];
    sysParts.push("You are Tamm AI Agent for a micro-brand. Follow brand role + rules.");
    sysParts.push("Anti-hallucination: If KB context does not support an answer, ask clarifying questions. Never invent price/stock/policies.");
    sysParts.push(`Role: ${agent.role}.`);
    sysParts.push(`Tone: ${agent.tone}.`);
    sysParts.push(`Language: ${agent.language}. Mirror the user's language.`);
    if (contextText) sysParts.push(`KB Context:\n${contextText}`);
    if (confidence < 0.45) sysParts.push("Confidence low: Ask 1-2 clarifying questions before making recommendations.");

    const replyText = await provider.chat(
      [{ role: "system", content: sysParts.join("\n\n") }, ...history],
      { temperature: agent.temperature ?? 0.4, maxTokens: agent.max_tokens ?? 800 },
    );

    const { data: outMsg, error: outErr } = await supabase
      .from("channel_messages")
      .insert({
        workspace_id,
        channel_id,
        conversation_id,
        direction: "out",
        sender_type: "ai",
        is_draft: mode === "draft",
        message_text: replyText,
        raw_payload: { agent_id, confidence, citations },
      })
      .select("id")
      .maybeSingle();
    if (outErr) throw outErr;

    if (mode === "reply") await bumpUsageCounters(supabase, workspace_id, { out: 1 });

    const inputTokens = roughTokens(sysParts.join("\n\n")) + roughTokens(history.map((m) => m.content).join("\n"));
    const outputTokens = roughTokens(replyText);

    await supabase.from("rag_traces").insert({
      workspace_id,
      conversation_id,
      message_id: outMsg?.id ?? null,
      query_text: lastUserText,
      rewritten_query: null,
      retrieved_chunk_ids: retrievedIds,
      citations,
      rerank_scores: rerankScores,
      confidence,
      model_cost: { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: 0 },
      latency_ms: Date.now() - startedAt,
    }).catch(() => {});

    await supabase.from("cost_events").insert({
      workspace_id,
      conversation_id,
      message_id: outMsg?.id ?? null,
      provider: "openai",
      model: "gpt-4o-mini",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: 0,
    }).catch(() => {});

    // Extraction (not for drafts)
    const intent = body.intent ?? "unknown";
    const extractText = `USER: ${lastUserText}\nASSISTANT: ${replyText}`;

    if (mode !== "draft" && intent === "sales") {
      const extracted = await extractOrder(provider, extractText);
      if (extracted) {
        await supabase.from("orders").insert({
          workspace_id,
          channel_id,
          conversation_id,
          customer_name: extracted.customer_name,
          phone: extracted.phone,
          address: extracted.address,
          items: extracted.items ?? [],
          total: extracted.total,
          status: "pending_confirmation",
        }).catch(() => {});
      }
    }
    if (mode !== "draft" && intent === "support") {
      const extracted = await extractTicket(provider, extractText);
      if (extracted) {
        await supabase.from("tickets").insert({
          workspace_id,
          channel_id,
          conversation_id,
          category: extracted.category,
          priority: extracted.priority,
          notes: extracted.notes,
          status: "open",
        }).catch(() => {});
      }
    }

    return jsonResponse({ reply: replyText, conversation_id, message_id: outMsg?.id ?? null, confidence, citations }, 200);
  } catch (e) {
    return jsonResponse({ error: String((e as any)?.message ?? e) }, 500);
  }
});
