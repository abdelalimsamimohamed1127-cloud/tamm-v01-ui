import { serve } from 'https://deno.land/std/http/server.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from '../_shared/supabase.ts';
import { normalizePlanTier, PLAN_LIMITS } from '../_shared/plan.ts';

type Body = { workspace_id: string; period_yyyymm?: string };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const workspaceId = body.workspace_id;
    if (!workspaceId) return jsonResponse({ error: 'workspace_id required' }, 400);

    const userId = await getAuthUserId(req);
    const supabase = getSupabaseAdmin();
    await assertWorkspaceMember(supabase, workspaceId, userId);

    const period = body.period_yyyymm ?? undefined;

    const { data: row, error } = await supabase.rpc('recompute_usage_counters', {
      p_workspace_id: workspaceId,
      p_period_yyyymm: period,
    });

    if (error) return jsonResponse({ error: error.message }, 400);

    const { data: wsSettings } = await supabase
      .from('workspace_settings')
      .select('plan_tier')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    const tier = normalizePlanTier(wsSettings?.plan_tier);
    const limits = PLAN_LIMITS[tier];

    return jsonResponse({ ok: true, tier, limits, usage: row }, 200);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
