import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type ChatRequest = {
  agent_id: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  top_k?: number;
};

async function embedQueryOpenAI(text: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Embeddings failed: ${resp.status} ${msg}`);
  }
  const json = await resp.json();
  return json.data[0].embedding as number[];
}

function buildContext(chunks: { content: string; similarity: number }[]) {
  const lines: string[] = [];
  for (const c of chunks) {
    const t = c.content.trim().slice(0, 1200);
    lines.push(`- (${c.similarity.toFixed(3)}) ${t}`);
  }
  return lines.join("\n");
}

async function callChatCompletion(systemPrompt: string, userMessageBlock: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessageBlock },
      ],
    }),
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Chat failed: ${resp.status} ${msg}`);
  }

  const json = await resp.json();
  return (json?.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a reply.") as string;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = (await req.json()) as ChatRequest;
    if (!body?.agent_id || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const agentRes = await sb
      .from("agents")
      .select("id, name, system_prompt, model, temperature, trained")
      .eq("id", body.agent_id)
      .single();

    if (agentRes.error) throw agentRes.error;
    const agent = agentRes.data;

    const lastUserMessage = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (!lastUserMessage.trim()) {
      return new Response(JSON.stringify({ error: "No user message provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!agent.trained) {
      return new Response(
        JSON.stringify({
          reply: "Your agent isn’t trained yet. Please add sources and retrain, then try again.",
          used_chunks: 0,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const queryEmbedding = await embedQueryOpenAI(lastUserMessage);

    const topK = Math.max(1, Math.min(body.top_k ?? 8, 20));
    const matchRes = await sb.rpc("match_agent_embeddings", {
      p_agent_id: body.agent_id,
      p_query_embedding: queryEmbedding,
      p_match_count: topK,
    });

    if (matchRes.error) throw matchRes.error;

    const chunks = (matchRes.data ?? []) as { content: string; similarity: number }[];
    const context = buildContext(chunks);

    const systemPrompt = (agent.system_prompt?.trim() || `You are ${agent.name || "an AI assistant"}.`).trim();

    const history = body.messages
      .slice(-10)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const userPrompt = `You are an AI agent for a business. Answer using ONLY the knowledge context when possible.

KNOWLEDGE CONTEXT:
${context || "(no context found)"}

CONVERSATION:
${history}

Now respond to the last USER message. If the context doesn't contain the answer, say you don't know and ask a clarifying question.`;

    const reply = await callChatCompletion(systemPrompt, userPrompt);

    return new Response(
      JSON.stringify({
        reply,
        used_chunks: chunks.length,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});