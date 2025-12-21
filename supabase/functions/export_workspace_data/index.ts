import { serve } from 'https://deno.land/std/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from '../_shared/supabase.ts';

type Body = { workspace_id: string };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = getSupabaseAdmin();
    const userId = await getAuthUserId(req);
    const body = (await req.json()) as Body;

    if (!body?.workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await assertWorkspaceMember(supabase, userId, body.workspace_id);

    const wsId = body.workspace_id;

    const [agents, channels, channelAgents, conversations, messages, orders, tickets, kbSources, settings, usage] =
      await Promise.all([
        supabase.from('agents').select('*').eq('workspace_id', wsId),
        supabase.from('channels').select('*').eq('workspace_id', wsId),
        supabase.from('channel_agents').select('*').eq('workspace_id', wsId),
        supabase.from('conversations').select('*').eq('workspace_id', wsId),
        // cap messages to avoid huge payloads
        supabase.from('channel_messages').select('*').eq('workspace_id', wsId).order('created_at', { ascending: true }).limit(50000),
        supabase.from('orders').select('*').eq('workspace_id', wsId),
        supabase.from('tickets').select('*').eq('workspace_id', wsId),
        supabase.from('knowledge_sources').select('*').eq('workspace_id', wsId),
        supabase.from('workspace_settings').select('*').eq('workspace_id', wsId).maybeSingle(),
        supabase.from('usage_counters').select('*').eq('workspace_id', wsId).order('period_yyyymm', { ascending: true }).limit(36),
      ]);

    const payload = {
      exported_at: new Date().toISOString(),
      workspace_id: wsId,
      agents: agents.data ?? [],
      channels: channels.data ?? [],
      channel_agents: channelAgents.data ?? [],
      conversations: conversations.data ?? [],
      channel_messages: messages.data ?? [],
      orders: orders.data ?? [],
      tickets: tickets.data ?? [],
      knowledge_sources: kbSources.data ?? [],
      workspace_settings: settings.data ?? null,
      usage_counters: usage.data ?? [],
    };

    // log request
    await supabase.from('data_requests').insert({ workspace_id: wsId, type: 'export', requested_by: userId, status: 'completed' });

    const filename = `tamm-export-${wsId}-${new Date().toISOString().slice(0,10)}.json`;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
