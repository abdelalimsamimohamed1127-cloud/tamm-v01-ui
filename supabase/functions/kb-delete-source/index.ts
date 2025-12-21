// Supabase Edge Function: kb-delete-source
// Deletes a knowledge source + its chunks/embeddings. Removes storage object if present.

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  getSupabaseAdmin,
  getAuthUserId,
  assertWorkspaceMember,
} from '../_shared/supabase.ts';
import { logAudit } from '../_shared/usage.ts';

const KB_BUCKET = Deno.env.get('KB_BUCKET') ?? 'kb';

type Payload = { workspace_id?: string; source_id?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const userId = await getAuthUserId(req);
    if (!userId) return jsonResponse({ error: 'Unauthorized' }, { status: 401 });

    const { workspace_id, source_id } = (await req.json()) as Payload;
    if (!workspace_id || !source_id) {
      return jsonResponse({ error: 'Missing workspace_id or source_id' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const isMember = await assertWorkspaceMember({
      supabase,
      workspaceId: workspace_id,
      userId,
    });
    if (!isMember) return jsonResponse({ error: 'Forbidden' }, { status: 403 });

    const { data: source, error: srcErr } = await supabase
      .from('knowledge_sources')
      .select('id, workspace_id, storage_path')
      .eq('id', source_id)
      .maybeSingle();

    if (srcErr) throw srcErr;
    if (!source || source.workspace_id !== workspace_id) {
      return jsonResponse({ error: 'Source not found' }, { status: 404 });
    }

    // Delete DB row (cascades chunks -> embeddings)
    const { error: delErr } = await supabase
      .from('knowledge_sources')
      .delete()
      .eq('id', source_id);

    if (delErr) throw delErr;

    // Delete storage object (best-effort)
    if (source.storage_path) {
      await supabase.storage.from(KB_BUCKET).remove([source.storage_path]);
    }

    await logAudit({
      supabase,
      workspaceId: workspace_id,
      actorUserId: userId,
      action: 'kb_source_deleted',
      targetType: 'knowledge_sources',
      targetId: source_id,
      metadata: { storage_path: source.storage_path ?? null },
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
