// EDGE FUNCTION: ingest_kb_source
// Multipart: file + workspace_id + source_type + title
import { serve } from 'https://deno.land/std/http/server.ts';
import { Buffer } from 'node:buffer';
import pdfParse from 'npm:pdf-parse@1.1.1';
import mammoth from 'npm:mammoth@1.6.0';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from '../_shared/supabase.ts';
import { chunkText, stripHtmlToText } from '../_shared/text.ts';
import { getProvider } from '../_shared/llm.ts';
import { enforceKbLimitsOrThrow, enforceSourceLimitsOrThrow, bumpUsageCounters } from '../_shared/usage.ts';

async function extractText(file: File) {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const ext = name.split('.').pop() || '';

  // TXT
  if (type.includes('text') || ext === 'txt') {
    return (await file.text()).trim();
  }

  // CSV
  if (type.includes('csv') || ext === 'csv') {
    return (await file.text()).trim();
  }

  // PDF
  if (type.includes('pdf') || ext === 'pdf') {
    const ab = await file.arrayBuffer();
    const data = await pdfParse(Buffer.from(ab));
    return (data?.text ?? '').trim();
  }

  // DOCX
  if (type.includes('wordprocessingml') || ext === 'docx') {
    const ab = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ buffer: Buffer.from(ab) } as any);
    return String(result?.value ?? '').trim();
  }

  // HTML
  if (type.includes('html') || ext === 'html' || ext === 'htm') {
    return stripHtmlToText(await file.text());
  }

  // Fallback: attempt text
  return (await file.text()).trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const workspace_id = String(form.get('workspace_id') ?? '');
    const source_type = String(form.get('source_type') ?? 'file');
    const title = String(form.get('title') ?? (file?.name ?? 'Source'));

    if (!workspace_id || !file) return jsonResponse({ error: 'workspace_id and file are required' }, 400);

    const supabase = getSupabaseAdmin();
    const userId = await getAuthUserId(req);
    await assertWorkspaceMember(supabase, workspace_id, userId);

    const provider = getProvider();

    const rawText = await extractText(file);
    if (!rawText) return jsonResponse({ error: 'No text extracted from file' }, 400);

    const chunks = chunkText(rawText, { chunkSize: 1100, overlap: 150 });

    // Create source row (use existing table if present)
    const sizeBytes = (await file.arrayBuffer()).byteLength;

    // enforce plan KB limits before ingestion
    try {
      await enforceKbLimitsOrThrow(supabase, workspace_id, sizeBytes);
    } catch (e: any) {
      return jsonResponse({
        blocked: true,
        code: e?.code ?? 'PLAN_LIMIT',
        message: e?.message ?? 'Plan limit reached',
        tier: e?.tier,
        limits: e?.limits,
        usage: e?.usage,
      }, 429);
    }


    // enforce sources count limit
    try {
      await enforceSourceLimitsOrThrow(supabase, workspace_id, 1);
    } catch (e: any) {
      return jsonResponse({
        blocked: true,
        code: e?.code ?? 'PLAN_LIMIT',
        message: e?.message ?? 'Plan limit reached',
        tier: e?.tier,
        limits: e?.limits,
        usage: e?.usage,
      }, 429);
    }

    const { data: src, error: srcErr } = await supabase
      .from('knowledge_sources')
      .insert({
        workspace_id,
        type: 'file',
        title,
        metadata: { source_type, filename: file.name, mime: file.type },
        size_bytes: sizeBytes,
        status: 'ready',
      } as any)
      .select('id')
      .maybeSingle();

    if (srcErr) throw srcErr;
    const sourceId = src?.id as string;

    // Embed + insert chunks
    let inserted = 0;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const [emb] = await provider.embed([c]);

      const { error: insErr } = await supabase.from('knowledge_chunks').insert({
        workspace_id,
        source_id: sourceId,
        chunk_index: i,
        content: c,
        metadata: { source_type, filename: file.name, chunk_index: i },
        embedding: emb,
      } as any);

      if (insErr) throw insErr;
      inserted++;
    }

    await bumpUsageCounters(supabase, workspace_id, { kbBytes: sizeBytes, sourcesCount: 1 });

    return jsonResponse({ source_id: sourceId, chunks_count: inserted, bytes: sizeBytes }, 200);
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
