import { serve } from 'https://deno.land/std/http/server.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin, getAuthUserId } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = getSupabaseAdmin();
    const userId = await getAuthUserId(req);

    // must be tamm_admin
    const { data: adminRow } = await supabase.from('tamm_admins').select('user_id').eq('user_id', userId).maybeSingle();
    if (!adminRow?.user_id) return jsonResponse({ error: 'Forbidden' }, 403);

    const { error } = await supabase.rpc('run_retention_cleanup');
    if (error) throw error;

    return jsonResponse({ ok: true }, 200);
  } catch (e) {
    return jsonResponse({ error: String((e as any)?.message ?? e) }, 500);
  }
});
