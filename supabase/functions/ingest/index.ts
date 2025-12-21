import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Source =
  | { type: "text"; payload: { text: string } }
  | { type: "qa"; payload: { items: { q: string; a: string }[] } }
  | { type: "website"; payload: { url: string } }
  | { type: "files"; payload: { storage_paths: string[]; extracted_text?: string } };

type IngestRequest = {
  agent_id: string;
  sources: Source[];
  mode?: "retrain" | "append";
};

function chunkText(text: string, chunkSize = 1000, overlap = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + chunkSize, clean.length);
    out.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = Math.max(0, end - overlap);
  }
  return out;
}

async function fetchWebsiteText(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "TammIngestBot/1.0" } });
  if (!res.ok) throw new Error(`Failed to fetch website: ${res.status}`);
  const html = await res.text();
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = withoutScripts.replace(/<[^>]+>/g, " ");
  return text;
}

async function embedBatchOpenAI(texts: string[]) {
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
      input: texts,
    }),
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Embeddings failed: ${resp.status} ${msg}`);
  }

  const json = await resp.json();
  return (json.data ?? []).map((d: any) => d.embedding as number[]);
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = (await req.json()) as IngestRequest;
    if (!body?.agent_id || !Array.isArray(body.sources)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const mode = body.mode ?? "retrain";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Retrain clears embeddings (keeps sources history; you can also clear sources if desired)
    if (mode === "retrain") {
      const del = await sb.from("agent_embeddings").delete().eq("agent_id", body.agent_id);
      if (del.error) throw del.error;
    }

    const chunksToEmbed: { agent_id: string; source_id: string; content: string }[] = [];

    for (const src of body.sources) {
      const insSource = await sb
        .from("agent_sources")
        .insert({ agent_id: body.agent_id, type: src.type, payload: src.payload })
        .select("id")
        .single();

      if (insSource.error) throw insSource.error;
      const sourceId = insSource.data.id as string;

      let text = "";

      if (src.type === "text") {
        text = src.payload.text;
      } else if (src.type === "qa") {
        text = src.payload.items.map((it) => `Q: ${it.q}\nA: ${it.a}`).join("\n\n");
      } else if (src.type === "website") {
        text = await fetchWebsiteText(src.payload.url);
      } else if (src.type === "files") {
        // MVP: accept extracted_text provided by client/worker
        text = src.payload.extracted_text ?? "";
        // TODO: later fetch from storage_paths and extract server-side using a worker.
      }

      if (!text.trim()) continue;

      const chunks = chunkText(text, 1000, 180);
      chunks.forEach((c) => chunksToEmbed.push({ agent_id: body.agent_id, source_id: sourceId, content: c }));
    }

    const BATCH = 50;
    for (let i = 0; i < chunksToEmbed.length; i += BATCH) {
      const slice = chunksToEmbed.slice(i, i + BATCH);
      const embeddings = await embedBatchOpenAI(slice.map((s) => s.content));

      const rows = slice.map((s, k) => ({
        agent_id: s.agent_id,
        source_id: s.source_id,
        content: s.content,
        embedding: embeddings[k],
      }));

      const insEmb = await sb.from("agent_embeddings").insert(rows);
      if (insEmb.error) throw insEmb.error;
    }

    const upd = await sb
      .from("agents")
      .update({
        trained: chunksToEmbed.length > 0,
        trained_at: new Date().toISOString(),
      })
      .eq("id", body.agent_id);

    if (upd.error) throw upd.error;

    return new Response(
      JSON.stringify({ ok: true, chunks: chunksToEmbed.length, trained: chunksToEmbed.length > 0 }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});