import { serve } from 'https://deno.land/std/http/server.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin, getAuthUserId, isTammAdmin } from '../_shared/supabase.ts';
import { normalizePlanTier } from '../_shared/plan.ts';

type Body = { workspace_id: string; plan_tier: string; request_id?: string };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const workspaceId = body.workspace_id;
    const planTier = normalizePlanTier(body.plan_tier);

    if (!workspaceId) return jsonResponse({ error: 'workspace_id required' }, 400);

    const userId = await getAuthUserId(req);
    const supabase = getSupabaseAdmin();

    const ok = await isTammAdmin(supabase, userId);
    if (!ok) return jsonResponse({ error: 'not_authorized' }, 403);

    // Ensure settings exists + update
    const { error: upErr } = await supabase
      .from('workspace_settings')
      .upsert({ workspace_id: workspaceId, plan_tier: planTier }, { onConflict: 'workspace_id' });

    if (upErr) return jsonResponse({ error: upErr.message }, 400);

    if (body.request_id) {
      await supabase
        .from('plan_upgrade_requests')
        .update({ status: 'approved', admin_note: `Approved -> ${planTier}` })
        .eq('id', body.request_id);
    }

    return jsonResponse({ ok: true, workspace_id: workspaceId, plan_tier: planTier }, 200);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
