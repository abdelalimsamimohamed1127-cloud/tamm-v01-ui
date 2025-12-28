import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import OpenAI from "https://deno.land/x/openai@v4.57.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type RunAgentRequest = {
  message?: string;
  session_id?: string;
  agent_id?: string;
  mode?: string; // ADDED
};

const encoder = new TextEncoder();

function roughTokens(text: string | null | undefined) {
  return Math.max(1, Math.ceil((text?.length ?? 0) / 4));
}

function formatContext(
  rows: { content?: string; similarity?: number; title?: string }[],
) {
  if (!rows.length) return "Context:\n(none)";
  const lines = rows.map((row, idx) => {
    const content = row.content?.trim() ?? "";
    const sim = typeof row.similarity === "number" ? row.similarity.toFixed(3) : "0.000";
    const title = row.title ? ` (source: ${row.title})` : "";
    return `[${idx + 1}] (${sim}) ${content}${title}`;
  });
  return `Context:\n${lines.join("\n")}`;
}

// Helper to generate a simple UUID for internal tracing if X-Request-ID is missing
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Structured logger
function logEvent(event: string, details: Record<string, any>, requestId: string, level: 'info' | 'warn' | 'error' = 'info') {
  const logObject = {
    timestamp: new Date().toISOString(),
    level,
    event,
    request_id: requestId,
    ...details,
  };
  console.log(JSON.stringify(logObject));
}

const RECENT_REQUESTS = new Map();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const requestId = req.headers.get("X-Request-ID") || generateUuid();
  logEvent("request_start", { method: req.method, url: req.url }, requestId);

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openaiKey || !supabaseUrl || !serviceKey) {
      throw new Error("Missing critical environment variables");
    }

    const { message, session_id, agent_id, mode } = await req.json() as RunAgentRequest;
    if (!message || !session_id || !agent_id) {
      return new Response(JSON.stringify({ error: "message, session_id, and agent_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency Check
    const requestHash = `${session_id}:${await crypto.subtle.digest('SHA-1', encoder.encode(message))}`;
    if (RECENT_REQUESTS.has(requestHash)) {
      logEvent("duplicate_request", { requestHash }, requestId, 'warn');
      return new Response(JSON.stringify({ error: "Duplicate request" }), { status: 429, headers: corsHeaders });
    }
    RECENT_REQUESTS.set(requestHash, Date.now());
    setTimeout(() => RECENT_REQUESTS.delete(requestHash), 2000); // Clear after 2s

    const supabase = createClient(supabaseUrl, serviceKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    // --- 1. Resolve Agent and Verify Webchat Channel ---
    const { data: channelData, error: channelError } = await supabase
      .from("agent_channels")
      .select("workspace_id, agent_id, status, config")
      .eq("agent_id", agent_id)
      .eq("platform", "webchat")
      .limit(1)
      .single();

    if (channelError || !channelData) {
      const errorMessage = `Webchat channel not found for agent: ${agent_id}`;
      logEvent("auth_error", { message: errorMessage, agent_id }, requestId, 'error');
      return new Response(JSON.stringify({ error: "Agent not found or webchat disabled" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isChannelActive = channelData.config?.is_active === true && channelData.status !== 'disconnected';
    if (!isChannelActive) {
      const errorMessage = `Webchat is not active for agent: ${agent_id}`;
      logEvent("auth_error", { message: errorMessage, agent_id }, requestId, 'warn');
      return new Response(JSON.stringify({ error: "This chat is currently unavailable" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const { workspace_id: workspaceId } = channelData;

    // --- 2. Find or Create Session ---
    let { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", session_id)
      .maybeSingle();

    if (sessionError) {
       throw new Error(`Session lookup error: ${sessionError.message}`);
    }

    if (!session) {
      const { data: newSession, error: newSessionError } = await supabase
        .from("chat_sessions")
        .insert({ id: session_id, agent_id, workspace_id: workspaceId })
        .select("id")
        .single();
      if (newSessionError) {
        throw new Error(`Session creation error: ${newSessionError.message}`);
      }
      session = newSession;
      logEvent("session_created", { session_id, agent_id, workspaceId }, requestId);
    }
    
    // --- (The rest of the logic from the original file follows) ---
    // This includes fetching agent config, history, context, calling OpenAI, etc.
    // We proceed with the knowledge that workspaceId and agent_id are now verified.

    const { data: agentData, error: agentFetchError } = await supabase
      .from("agents")
      .select("draft_version_id, published_version_id, config")
      .eq("id", agent_id)
      .single();

    if (agentFetchError) throw new Error(`Failed to fetch agent details: ${agentFetchError.message}`);
    
    const currentMode = mode || "live";
    let agentConfig: Record<string, any> = {};
    const versionIdToUse = agentData[`${currentMode}_version_id`];

    if (versionIdToUse) {
        const { data: versionData, error: versionError } = await supabase
            .from("agent_versions")
            .select("config_jsonb")
            .eq("id", versionIdToUse)
            .single();
        if (versionError) {
             logEvent("runtime_warning", { message: `Could not fetch agent version config: ${versionError.message}`}, requestId, 'warn');
        } else if (versionData) {
            agentConfig = versionData.config_jsonb || {};
        }
    }
    if (Object.keys(agentConfig).length === 0) {
        agentConfig = agentData.config || {};
    }
    
    const systemPrompt = agentConfig.system_prompt || "You are a helpful AI assistant.";
    const historySize = agentConfig.history_size || 5;

    const { data: balanceData, error: balanceError } = await supabase.rpc(
      "get_wallet_balance",
      { p_workspace_id: workspaceId },
    );
    if (balanceError || (typeof balanceData === "number" ? balanceData : balanceData?.balance ?? 0) <= 0) {
      const err = "Insufficient credits";
      logEvent("insufficient_credits", { workspaceId, agent_id, balance: balanceData }, requestId, 'warn');
      return new Response(JSON.stringify({ error: err }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    logEvent("agent_invocation_params", { message_length: message.length, session_id, agent_id, workspaceId, mode: currentMode }, requestId);

    const { data: historyRows, error: historyError } = await supabase
      .from("agent_chat_messages")
      .select("role, content")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true })
      .limit(historySize);

    const history = (historyError ? [] : (historyRows ?? [])).map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content ?? "",
    }));

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });
    const embedding = embeddingResponse.data?.[0]?.embedding;

    const { data: matchRows, error: matchError } = await supabase.rpc("match_site_pages", {
      query_embedding: embedding,
      match_count: 5,
      p_workspace_id: workspaceId,
    });

    const filteredMatches = (matchError ? [] : (matchRows ?? []))
      .filter((row: any) => Number(row.similarity ?? 0) > 0.75)
      .slice(0, 5);
    const context = formatContext(filteredMatches);

    const fullSystemPrompt = `${systemPrompt}\n\nUse this context: ${context}. If unsure, say "I don't know".`;

    const messages = [
      { role: "system", content: fullSystemPrompt },
      ...history,
      { role: "user", content: message },
    ] as { role: "user" | "assistant" | "system"; content: string }[];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages,
    });

    const inputTokens = roughTokens(messages.map((m) => `${m.role}: ${m.content ?? ""}`).join("\n"));
    let outputTokens = 0;
    let fullText = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const delta = chunk.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              fullText += delta;
              outputTokens += roughTokens(delta);
              controller.enqueue(encoder.encode(delta));
            }
          }
          controller.close();

          logEvent("model_response_received", { inputTokens, outputTokens, fullTextLength: fullText.length, session_id, agent_id, workspaceId }, requestId);

          const { error: messageError } = await supabase.from("agent_chat_messages").insert([
            { session_id, role: "user", content: message, token_count: roughTokens(message), agent_id, workspace_id },
            { session_id, role: "assistant", content: fullText, token_count: outputTokens, agent_id, workspace_id },
          ]);
          if (messageError) throw messageError;
          
          const costUsd = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);
          await supabase.from("usage_events").insert({ workspace_id: workspaceId, agent_id, event_type: "model_inference", model: "gpt-4o-mini", input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd });
          await supabase.rpc("deduct_credits", { p_workspace_id: workspaceId, amount: costUsd });

        } catch (err: any) {
          logEvent("stream_error", { message: err.message, session_id, agent_id }, requestId, 'error');
          controller.error(err);
        }
      },
    });

    logEvent("response_stream_start", { session_id, agent_id, workspaceId }, requestId);
    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" }});
  } catch (e: any) {
    const errorMessage = String((e as any)?.message ?? e);
    logEvent("unhandled_exception", { message: errorMessage }, requestId, 'error');
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});
