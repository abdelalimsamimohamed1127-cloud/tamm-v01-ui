import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import OpenAI from "https://deno.land/x/openai@v4.57.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type RunAgentRequest = {
  message?: string;
  session_id?: string;
  agent_id?: string;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!openaiKey || !supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, session_id, agent_id } = await req.json() as RunAgentRequest;
    if (!message || !session_id || !agent_id) {
      return new Response(JSON.stringify({ error: "message, session_id, and agent_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, workspace_id")
      .eq("id", agent_id)
      .maybeSingle();
    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id, workspace_id, agent_id")
      .eq("id", session_id)
      .maybeSingle();
    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.agent_id !== agent.id || session.workspace_id !== agent.workspace_id) {
      return new Response(JSON.stringify({ error: "Session/agent mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = agent.workspace_id;

    const { data: balanceData, error: balanceError } = await supabase.rpc(
      "get_wallet_balance",
      { workspace_id: workspaceId },
    );
    if (balanceError) {
      return new Response(JSON.stringify({ error: "Unable to check balance" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const balance = typeof balanceData === "number" ? balanceData : balanceData?.balance ?? 0;
    if (balance <= 0) {
      return new Response(JSON.stringify({ error: "Insufficient credits" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: historyRows, error: historyError } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("session_id", session_id)
      .order("created_at", { ascending: false })
      .limit(5);
    const history = (historyError ? [] : (historyRows ?? [])).reverse().map((row) => ({
      role: row.role as "user" | "assistant" | "system",
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
      workspace_id: workspaceId,
    });

    const filteredMatches = (matchError ? [] : (matchRows ?? []))
      .filter((row: any) => Number(row.similarity ?? 0) > 0.75)
      .slice(0, 5);
    const context = formatContext(filteredMatches);

    const messages = [
      {
        role: "system",
        content: `You are a helpful assistant. Use this context: ${context}. If unsure, say "I don't know".`,
      },
      ...history,
      { role: "user", content: message },
    ] as { role: "user" | "assistant" | "system"; content: string }[];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages,
    });

    const inputTokens = roughTokens(
      messages.map((m) => `${m.role}: ${m.content ?? ""}`).join("\n"),
    );
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

          const { error: messageError } = await supabase.from("chat_messages").insert([
            {
              session_id,
              role: "user",
              content: message,
              token_count: roughTokens(message),
            },
            {
              session_id,
              role: "assistant",
              content: fullText,
              token_count: outputTokens,
            },
          ]);
          if (messageError) throw messageError;

          outputTokens = Math.max(outputTokens, roughTokens(fullText));

          const costUsd = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);

          await supabase.from("usage_events").insert({
            workspace_id: workspaceId,
            agent_id,
            event_type: "model_inference",
            model: "gpt-4o-mini",
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost_usd: costUsd,
          }).catch(() => {});

          await supabase.rpc("deduct_credits", {
            workspace_id: workspaceId,
            amount: costUsd,
          }).catch(() => {});
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
