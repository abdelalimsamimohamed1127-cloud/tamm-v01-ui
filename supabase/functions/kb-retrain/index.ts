import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { agent_id } = await req.json();
    if (!agent_id) return new Response(JSON.stringify({ error: 'missing agent_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: agentRow, error: aErr } = await sb.from('agents').select('id, workspace_id').eq('id', agent_id).single();
    if (aErr) throw aErr;

    const { data: srcs, error: sErr } = await sb.from('kb_sources').select('id').eq('agent_id', agent_id);
    if (sErr) throw sErr;

    const total = srcs?.length ?? 0;

    const { data: job, error: jErr } = await sb.from('kb_jobs').insert({
      workspace_id: agentRow.workspace_id,
      agent_id,
      status: 'processing',
      total_sources: total,
      processed_sources: 0,
    }).select('*').single();
    if (jErr) throw jErr;

    // Mark sources as ready (placeholder)
    let processed = 0;
    for (const s of (srcs ?? [])) {
      await sb.from('kb_sources').update({ status: 'ready' }).eq('id', s.id);
      processed += 1;
      await sb.from('kb_jobs').update({ processed_sources: processed }).eq('id', job.id);
    }

    await sb.from('kb_jobs').update({ status: 'done' }).eq('id', job.id);
    await sb.from('agents').update({ last_trained_at: new Date().toISOString() }).eq('id', agent_id);

    return new Response(JSON.stringify({ ok: true, job_id: job.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
