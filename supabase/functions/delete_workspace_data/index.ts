// EDGE FUNCTION: delete_workspace_data
// Hard-deletes workspace-scoped data (MVP). Intended for GDPR delete-on-request.
import { serve } from 'https://deno.land/std/http/server.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from '../_shared/supabase.ts';

type Body = { workspace_id: string; confirm?: boolean };

const DELETE_ORDER = [
  'channel_messages',
  'orders',
  'tickets',
  'channel_agents',
  'channels',
  'agents',
  'knowledge_chunks',
  'knowledge_sources',
  'usage_counters',
  'audit_logs',
  'workspace_settings',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { workspace_id, confirm } = (await req.json()) as Body;
    if (!workspace_id) return jsonResponse({ error: 'workspace_id required' }, 400);
    if (!confirm) return jsonResponse({ error: 'confirm=true required' }, 400);

    const supabase = getSupabaseAdmin();
    const userId = await getAuthUserId(req);
    await assertWorkspaceMember(supabase, workspace_id, userId);

    const { data: dr } = await supabase
      .from('data_requests')
      .insert({ workspace_id, requested_by: userId, type: 'delete' })
      .select('id')
      .maybeSingle();

    const deleted: Record<string, number> = {};

    for (const table of DELETE_ORDER) {
      const { data, error } = await supabase.from(table).delete().eq('workspace_id', workspace_id).select('id');
      if (error) throw error;
      deleted[table] = (data ?? []).length;
    }

    // Finally delete conversations
    const { data: convDel, error: convErr } = await supabase.from('conversations').delete().eq('workspace_id', workspace_id).select('id');
    if (convErr) throw convErr;
    deleted['conversations'] = (convDel ?? []).length;

    if (dr?.id) {
      await supabase
        .from('data_requests')
        .update({ status: 'completed', completed_at: new Date().toISOString(), result: { deleted } })
        .eq('id', dr.id);
    }

    return jsonResponse({ ok: true, deleted }, 200);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
