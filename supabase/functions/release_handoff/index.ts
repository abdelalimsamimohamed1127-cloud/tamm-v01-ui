import { serve } from 'https://deno.land/std/http/server.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from '../_shared/supabase.ts';

type Body = {
  workspace_id: string;
  conversation_id: string;
  reason?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    const { workspace_id, conversation_id } = body ?? ({} as any);
    if (!workspace_id || !conversation_id) return jsonResponse({ error: 'Missing fields' }, 400);

    const supabase = getSupabaseAdmin();
    const userId = await getAuthUserId(req);
    await assertWorkspaceMember(supabase, workspace_id, userId);

    const patch: any = { status: 'open' };
    if ('open' === 'handoff') patch.handoff_reason = body.reason ?? 'manual';

    const { error } = await supabase
      .from('conversations')
      .update(patch)
      .eq('id', conversation_id)
      .eq('workspace_id', workspace_id);

    if (error) throw error;
    return jsonResponse({ ok: true, status: 'open' }, 200);
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
