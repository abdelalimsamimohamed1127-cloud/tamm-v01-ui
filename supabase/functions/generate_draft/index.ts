// EDGE FUNCTION: generate_draft
// Generates an AI draft suggestion for a conversation (even during handoff) but does NOT send it automatically.
import { serve } from 'https://deno.land/std/http/server.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from '../_shared/supabase.ts';
import { getProvider } from '../_shared/llm.ts';
import { writeAudit } from '../_shared/usage.ts';

type Body = {
  workspace_id: string;
  channel_id: string;
  conversation_id: string;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const { workspace_id, channel_id, conversation_id } = body ?? ({} as any);
    if (!workspace_id || !channel_id || !conversation_id) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const supabase = getSupabaseAdmin();
    const userId = await getAuthUserId(req);
    await assertWorkspaceMember(supabase, workspace_id, userId);

    // Load last customer message
    const { data: lastMsg } = await supabase
      .from('channel_messages')
      .select('message_text')
      .eq('conversation_id', conversation_id)
      .eq('sender_type', 'customer')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const last_user_text = lastMsg?.message_text ?? '';
    if (!last_user_text) return jsonResponse({ error: 'No customer message found' }, 400);

    let intent = deterministicIntent(last_user_text);

    if (intent === 'unknown') {
      const provider = getProvider();
      const sys = 'You are a classifier. Return ONLY JSON with key intent in [sales,support,unknown].';
      const user = `Text:\n${last_user_text}\nReturn JSON like {"intent":"sales"}.`;
      const out = await provider.chat(
        [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        { temperature: 0, max_tokens: 60 }
      );
      try {
        const parsed = JSON.parse(out.trim());
        if (parsed?.intent === 'sales' || parsed?.intent === 'support' || parsed?.intent === 'unknown') {
          intent = parsed.intent;
        }
      } catch (_) {
        // ignore
      }
    }

    // Pick agent based on channel mapping
    const { data: mappings } = await supabase
      .from('channel_agents')
      .select('agent_id,mode,is_enabled')
      .eq('workspace_id', workspace_id)
      .eq('channel_id', channel_id)
      .eq('is_enabled', true);

    const enabled = (mappings ?? []).map((m: any) => m.agent_id);
    if (enabled.length === 0) return jsonResponse({ error: 'No agents mapped to channel' }, 400);

    let agent_id = enabled[0];
    const prefer = (intent === 'sales') ? ['sales','primary'] : (intent === 'support') ? ['support','primary'] : ['primary','general','sales','support'];
    const pick = (mappings ?? []).find((m: any) => prefer.includes(String(m.mode)));
    if (pick?.agent_id) agent_id = pick.agent_id;

    await writeAudit(supabase, workspace_id, userId, 'generate_draft', 'conversations', conversation_id, { channel_id, agent_id, intent });

    // Delegate to run_agent with mode=draft (reuse runtime + RAG + prompt)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const auth = req.headers.get('authorization')!;
    const resp = await fetch(`${supabaseUrl}/functions/v1/run_agent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: auth },
      body: JSON.stringify({
        workspace_id,
        channel_id,
        conversation_id,
        agent_id,
        intent,
        last_user_text,
        mode: 'draft',
      }),
    });

    const data = await resp.json();
    return jsonResponse(data, resp.status);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
