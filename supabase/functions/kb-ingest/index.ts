// Supabase Edge Function: kb-ingest
// Ingest a knowledge_sources row into chunks + embeddings.
// Inputs: { source_id: string }
// Security: requires Authorization Bearer token (member of workspace)

import { Buffer } from 'node:buffer';
import pdfParse from 'npm:pdf-parse@1.1.1';
import mammoth from 'npm:mammoth@1.6.0';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  getSupabaseAdmin,
  getAuthUserId,
  assertWorkspaceMember,
} from '../_shared/supabase.ts';
import { createEmbeddings, estimateTokens } from '../_shared/openai.ts';
import { chunkText, stripHtmlToText } from '../_shared/text.ts';
import { logUsage, logAudit } from '../_shared/usage.ts';
import { autoFormatStructured, objectsToCTF } from '../_shared/ctf.ts';

const KB_BUCKET = Deno.env.get('KB_BUCKET') ?? 'kb';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type SourceRow = {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  type: string;
  title: string | null;
  source_url: string | null;
  storage_path: string | null;
  raw_text: string | null;
  status: string;
};

async function extractTextFromFile(params: {
  blob: Blob;
  filename: string;
  mimeType?: string | null;
}) {
  const { blob, filename, mimeType } = params;

  if (blob.size > MAX_FILE_BYTES) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  const lower = filename.toLowerCase();
  const ext = lower.includes('.') ? lower.split('.').pop() : '';
  const effectiveType = (mimeType ?? '').toLowerCase();

  // PDF
  if (effectiveType.includes('pdf') || ext === 'pdf') {
    const ab = await blob.arrayBuffer();
    const data = await pdfParse(Buffer.from(ab));
    return (data?.text ?? '').trim();
  }

  // DOCX
  if (
    effectiveType.includes('wordprocessingml') ||
    ext === 'docx' ||
    effectiveType.includes('docx')
  ) {
    const ab = await blob.arrayBuffer();
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(ab),
    } as any);
    return String(result?.value ?? '').trim();
  }

  // TXT/CSV/MD/JSON
  if (['txt', 'csv', 'md', 'json'].includes(String(ext))) {
    return (await blob.text()).trim();
  }

  // Fallback: try to read as text
  return (await blob.text()).trim();
}

async function extractTextFromSource(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  source: SourceRow;
}) {
  const { supabase, source } = params;

  if (source.type === 'text' || source.type === 'qa') {
    const raw = (source.raw_text ?? '').trim();
    // If user pasted a large JSON array, compress it (auto-switch JSON vs CTF)
    const formatted = autoFormatStructured(raw);
    return formatted.output;
  }

  if (source.type === 'url' || source.type === 'website') {
    const url = (source.source_url ?? '').trim();
    if (!url) throw new Error('Missing source_url for website source.');

    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) {
      throw new Error(`Failed to fetch website: ${resp.status}`);
    }
    const html = await resp.text();
    return stripHtmlToText(html);
  }

  if (source.type === 'catalog') {
    // Catalog lives in catalog_items; we generate a compact text representation
    const { data: rows, error } = await supabase
      .from('catalog_items')
      .select('row')
      .eq('workspace_id', source.workspace_id)
      .eq('agent_id', source.agent_id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const objects = (rows ?? []).map((r: any) => r.row).filter(Boolean);
    if (!objects.length) return '';
    // Always use CTF for catalogs (reduces prompt tokens a lot)
    return objectsToCTF(objects);
  }

  // Files
  const path = (source.storage_path ?? '').trim();
  if (!path) throw new Error('Missing storage_path for file source.');

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(KB_BUCKET)
    .download(path);

  if (downloadError) throw downloadError;
  if (!fileData) throw new Error('Could not download file from storage.');

  const filename = path.split('/').pop() ?? path;

  const text = await extractTextFromFile({
    blob: fileData,
    filename,
  });

  // If it's a JSON array, auto-switch JSON vs CTF (big cost saver)
  const formatted = autoFormatStructured(text);
  return formatted.output;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await req.json()) as { source_id?: string };
    const sourceId = payload?.source_id;

    if (!sourceId) {
      return jsonResponse({ error: 'Missing source_id' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: source, error: sourceError } = await supabase
      .from('knowledge_sources')
      .select('id, workspace_id, agent_id, type, title, source_url, storage_path, raw_text, status')
      .eq('id', sourceId)
      .maybeSingle();

    if (sourceError) throw sourceError;
    if (!source) {
      return jsonResponse({ error: 'Source not found' }, { status: 404 });
    }

    const isMember = await assertWorkspaceMember({
      supabase,
      workspaceId: source.workspace_id,
      userId,
    });

    if (!isMember) {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: walletBalance, error: walletError } = await supabase.rpc(
      'get_wallet_balance',
      { workspace_id: source.workspace_id },
    );

    if (walletError) throw walletError;

    if ((walletBalance as any)?.balance < 20) {
      return jsonResponse(
        { error: 'Insufficient credits for knowledge ingestion' },
        { status: 402 },
      );
    }

    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) {
      return jsonResponse(
        { error: 'Missing OPENAI_API_KEY on Edge Function env' },
        { status: 500 },
      );
    }

    // Mark processing
    await supabase
      .from('knowledge_sources')
      .update({ status: 'processing', error: null })
      .eq('id', sourceId);

    // Extract text
    const text = await extractTextFromSource({ supabase, source: source as any });
    if (!text) {
      await supabase
        .from('knowledge_sources')
        .update({ status: 'failed', error: 'No text extracted from source.' })
        .eq('id', sourceId);

      return jsonResponse({ error: 'No text extracted from source.' }, { status: 400 });
    }

    // Chunk
    const chunks = chunkText(text, { chunkSize: 1000, overlap: 200 });

    // Delete old chunks (cascades embeddings)
    await supabase.from('knowledge_chunks').delete().eq('source_id', sourceId);

    // Insert chunks
    const chunkRows = chunks.map((content, idx) => ({
      source_id: sourceId,
      chunk_index: idx,
      content,
    }));

    const { data: insertedChunks, error: chunksError } = await supabase
      .from('knowledge_chunks')
      .insert(chunkRows)
      .select('id, content');

    if (chunksError) throw chunksError;
    if (!insertedChunks?.length) throw new Error('Failed to insert chunks');

    // Embeddings (batch)
    // Pick embedding model (agent-specific if available)
    let embeddingModel = 'text-embedding-3-small';
    if (source.agent_id) {
      const { data: agentRow } = await supabase
        .from('agents')
        .select('llm_embedding_model')
        .eq('id', source.agent_id)
        .maybeSingle();
      if ((agentRow as any)?.llm_embedding_model) {
        embeddingModel = String((agentRow as any).llm_embedding_model);
      }
    }
    const inputs = insertedChunks.map((c: any) => String(c.content));

    const embeddings: number[][] = [];
    const BATCH = 64;
    for (let i = 0; i < inputs.length; i += BATCH) {
      const batch = inputs.slice(i, i + BATCH);
      const vecs = await createEmbeddings({
        apiKey: openAiKey,
        model: embeddingModel,
        input: batch,
      });
      embeddings.push(...vecs);
    }

    const embeddingRows = insertedChunks.map((chunk: any, idx: number) => ({
      chunk_id: chunk.id,
      embedding: embeddings[idx],
    }));

    const { error: embeddingsError } = await supabase
      .from('knowledge_embeddings')
      .insert(embeddingRows);

    if (embeddingsError) throw embeddingsError;

    // Mark ready
    await supabase
      .from('knowledge_sources')
      .update({ status: 'ready', error: null })
      .eq('id', sourceId);

    // Usage tracking (approx)
    const tokenEstimate = estimateTokens(text);
    await logUsage({
      supabase,
      workspaceId: source.workspace_id,
      agentId: source.agent_id,
      eventType: 'kb_ingest_text_chars',
      quantity: text.length,
      unit: 'chars',
      meta: { source_id: sourceId, chunks: chunks.length },
    });

    await logUsage({
      supabase,
      workspaceId: source.workspace_id,
      agentId: source.agent_id,
      eventType: 'kb_embedding_tokens_est',
      quantity: tokenEstimate,
      unit: 'tokens',
      meta: { source_id: sourceId, chunks: chunks.length, model: embeddingModel },
    });

    await logAudit({
      supabase,
      workspaceId: source.workspace_id,
      actorUserId: userId,
      action: 'kb_source_ingested',
      targetType: 'knowledge_sources',
      targetId: sourceId,
      metadata: { chunks: chunks.length },
    });

    try {
      await supabase.rpc('deduct_credits', {
        ws_id: source.workspace_id,
        amount: 20,
        reason: 'kb_ingest_fee',
        meta: { file_type: 'pdf' },
      });
    } catch (deductError) {
      console.error('Credit deduction failed', deductError);
    }

    return jsonResponse({
      ok: true,
      source_id: sourceId,
      chunks: chunks.length,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});