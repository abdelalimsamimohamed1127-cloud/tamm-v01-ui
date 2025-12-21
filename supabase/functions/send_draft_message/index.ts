import { serve } from 'https://deno.land/std/http/server.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from '../_shared/supabase.ts';

type Body = { workspace_id: string; draft_message_id: string };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = getSupabaseAdmin();
    const authUserId = await getAuthUserId(req);
    const body = (await req.json()) as Body;

    if (!body?.workspace_id || !body?.draft_message_id) {
      return jsonResponse({ error: 'Missing workspace_id or draft_message_id' }, 400);
    }

    await assertWorkspaceMember(supabase, authUserId, body.workspace_id);

    const { data: draft, error: dErr } = await supabase
      .from('channel_messages')
      .select('id,workspace_id,channel_id,conversation_id,message_text,is_draft')
      .eq('id', body.draft_message_id)
      .maybeSingle();

    if (dErr) throw dErr;
    if (!draft?.id) return jsonResponse({ error: 'Draft not found' }, 404);
    if (!draft.is_draft) return jsonResponse({ error: 'Message is not a draft' }, 400);

    const { data: sent, error: sErr } = await supabase
      .from('channel_messages')
      .insert({
        workspace_id: draft.workspace_id,
        channel_id: draft.channel_id,
        conversation_id: draft.conversation_id,
        direction: 'out',
        sender_type: 'human',
        message_text: draft.message_text,
        raw_payload: { sent_from_draft: draft.id },
        is_draft: false,
      })
      .select('id')
      .maybeSingle();

    if (sErr) throw sErr;

    await supabase
      .from('channel_messages')
      .update({ is_draft: false, raw_payload: { ...(draft as any).raw_payload, draft_sent_message_id: sent?.id, draft_sent_at: new Date().toISOString() } })
      .eq('id', draft.id);

    return jsonResponse({ ok: true, sent_message_id: sent?.id, conversation_id: draft.conversation_id }, 200);
  } catch (e) {
    return jsonResponse({ error: String((e as any)?.message ?? e) }, 500);
  }
});
