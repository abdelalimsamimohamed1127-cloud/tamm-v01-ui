import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Buffer } from "node:buffer";
import pdfParse from "npm:pdf-parse@1.1.1";
import mammoth from "npm:mammoth@1.6.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { chunkText } from "../_shared/text.ts";
import { createEmbeddings } from "../_shared/openai.ts";
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from "../_shared/supabase.ts";

const BUCKET = "agent_files";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

async function fileToText(file: File): Promise<string> {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const ext = name.split(".").pop() || "";

  const buf = Buffer.from(await file.arrayBuffer());

  // PDF
  if (type.includes("pdf") || ext === "pdf") {
    const parsed = await pdfParse(buf);
    return (parsed.text || "").trim();
  }

  // DOCX
  if (
    type.includes("wordprocessingml") ||
    type.includes("msword") ||
    ext === "docx" ||
    ext === "doc"
  ) {
    // mammoth expects ArrayBuffer
    const res = await mammoth.extractRawText({ buffer: buf });
    return (res.value || "").trim();
  }

  // CSV/TXT fallback
  if (type.includes("text") || ext === "txt" || ext === "csv") {
    return buf.toString("utf-8").trim();
  }

  // Generic fallback: try utf-8
  return buf.toString("utf-8").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabase = getSupabaseAdmin();

    const userId = await getAuthUserId(req);
    const form = await req.formData();

    const agent_id = String(form.get("agent_id") || "").trim();
    const workspace_id = String(form.get("workspace_id") || "").trim();
    const file = form.get("file");

    if (!agent_id || !workspace_id) {
      return jsonResponse({ error: "Missing agent_id or workspace_id" }, 400);
    }
    if (!(file instanceof File)) {
      return jsonResponse({ error: "Missing file" }, 400);
    }

    // Security: user must be a member of the workspace, and agent must belong to workspace
    await assertWorkspaceMember(supabase, userId, workspace_id);

    const { data: agentRow, error: agentErr } = await supabase
      .from("agents")
      .select("id, workspace_id")
      .eq("id", agent_id)
      .maybeSingle();

    if (agentErr) throw agentErr;
    if (!agentRow?.id) return jsonResponse({ error: "Agent not found" }, 404);
    if (agentRow.workspace_id !== workspace_id) {
      return jsonResponse({ error: "Agent/workspace mismatch" }, 403);
    }

    const now = new Date();
    const key = `${agent_id}/${now.toISOString().replace(/[:.]/g, "-")}-${safeName(file.name)}`;

    // Upload file to storage (service role bypasses bucket policies)
    const arr = new Uint8Array(await file.arrayBuffer());
    const upload = await supabase.storage.from(BUCKET).upload(key, arr, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upload.error) throw upload.error;

    // Extract -> chunk -> embed
    const extracted = await fileToText(file);
    if (!extracted.trim()) {
      return jsonResponse({ error: "Could not extract text from file" }, 400);
    }

    const { data: src, error: srcErr } = await supabase
      .from("agent_sources")
      .insert({
        agent_id,
        type: "files",
        payload: {
          storage_bucket: BUCKET,
          storage_path: key,
          filename: file.name,
          mime: file.type,
          size_bytes: file.size,
        },
      })
      .select("id")
      .single();

    if (srcErr) throw srcErr;
    const sourceId = src.id as string;

    const chunks = chunkText(extracted, 1000, 180);
    if (!chunks.length) return jsonResponse({ ok: true, source_id: sourceId, chunks: 0 }, 200);

    // Embed in batches (createEmbeddings supports batching)
    const embeddings = await createEmbeddings(chunks);

    const rows = chunks.map((content, i) => ({
      agent_id,
      source_id: sourceId,
      content,
      embedding: embeddings[i],
    }));

    const ins = await supabase.from("agent_embeddings").insert(rows);
    if (ins.error) throw ins.error;

    await supabase
      .from("agents")
      .update({ trained: true, trained_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", agent_id);

    return jsonResponse(
      {
        ok: true,
        source_id: sourceId,
        chunks: chunks.length,
        storage: { bucket: BUCKET, path: key },
      },
      200,
    );
  } catch (e: any) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});