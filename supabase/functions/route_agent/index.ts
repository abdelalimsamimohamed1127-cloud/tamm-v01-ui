// EDGE FUNCTION: route_agent
  // Hybrid deterministic + GPT classification (strict JSON output)
  import { serve } from 'https://deno.land/std/http/server.ts';
  import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
  import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from '../_shared/supabase.ts';
  import { getProvider } from '../_shared/llm.ts';
  import { writeAudit } from '../_shared/usage.ts';

  type Body = {
    workspace_id: string;
    channel_id: string;
    conversation_id: string;
    last_user_text: string;
  };

  function deterministicIntent(text: string): 'sales' | 'support' | 'unknown' {
    const t = text.toLowerCase();
    const support = [
      'refund','return','complain','complaint','bad','broken','late','delay','problem','issue',
      'استرجاع','مرتجع','ارجاع','شكوى','مشكلة','تأخير','متأخر','وصل غلط','استبدال','جودة'
    ];
    const sales = [
      'price','cost','buy','order','deliver','delivery','ship','available','stock','size','color',
      'سعر','عايز','اشتري','اطلب','اوردر','توصيل','شحن','متاح','المقاس','اللون','عندكم'
    ];
    if (support.some((k)=>t.includes(k))) return 'support';
    if (sales.some((k)=>t.includes(k))) return 'sales';
    return 'unknown';
  }

  async function gptIntent(text: string): Promise<'sales'|'support'|'unknown'> {
    const provider = getProvider();
    const sys = `You are an intent classifier for a social commerce inbox.
Return ONLY valid JSON.
Schema: {"intent":"sales"|"support"|"unknown","confidence":0-1,"reason":string}`;
    const out = await provider.chat([
      { role:'system', content: sys },
      { role:'user', content: text }
    ], { temperature: 0, maxTokens: 120 });
    try {
      const json = JSON.parse(out.trim().replace(/^```json|```$/g,''));
      const intent = String(json.intent ?? 'unknown');
      if (intent === 'sales' || intent === 'support' || intent === 'unknown') return intent;
    } catch { /* ignore */ }
    return 'unknown';
  }

  serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
      const body = (await req.json()) as Body;
      const { workspace_id, channel_id, conversation_id, last_user_text } = body ?? ({} as any);
      if (!workspace_id || !channel_id || !conversation_id || !last_user_text) {
        return jsonResponse({ error: 'Missing required fields' }, 400);
      }

      const supabase = getSupabaseAdmin();

      // Auth: require dashboard JWT
      const userId = await getAuthUserId(req);
      await assertWorkspaceMember(supabase, workspace_id, userId);

      let intent = deterministicIntent(last_user_text);
      if (intent === 'unknown') {
        intent = await gptIntent(last_user_text);
      }

      // Choose agent mapped to channel
      const { data: mappings, error: mapErr } = await supabase
        .from('channel_agents')
        .select('agent_id, mode, is_enabled')
        .eq('workspace_id', workspace_id)
        .eq('channel_id', channel_id)
        .eq('is_enabled', true);

      if (mapErr) throw mapErr;

      const enabled = (mappings ?? []).filter((m: any) => m.is_enabled);
      let agentId: string | null = null;

      const byMode = (mode: string) => enabled.find((m: any) => String(m.mode).toLowerCase() === mode)?.agent_id;

      if (intent === 'sales') agentId = byMode('sales') ?? byMode('primary') ?? enabled[0]?.agent_id ?? null;
      else if (intent === 'support') agentId = byMode('support') ?? byMode('secondary') ?? enabled[0]?.agent_id ?? null;
      else agentId = enabled[0]?.agent_id ?? null;

      if (!agentId) {
        // fallback to any agent in workspace
        const { data: anyAgent } = await supabase
          .from('agents')
          .select('id')
          .eq('workspace_id', workspace_id)
          .limit(1)
          .maybeSingle();
        agentId = anyAgent?.id ?? null;
      }

      if (!agentId) return jsonResponse({ error: 'No agent found for channel' }, 409);

      await writeAudit({
        supabase,
        workspaceId: workspace_id,
        actorUserId: userId,
        action: 'route_agent',
        targetType: 'conversation',
        targetId: conversation_id,
        metadata: { channel_id, agent_id: agentId, intent },
      });

      return jsonResponse({ intent, agent_id: agentId }, 200);
    } catch (e) {
      return jsonResponse({ error: String(e?.message ?? e) }, 500);
    }
  });
