// EDGE FUNCTION: ingest_channel_message
// Creates/loads conversation, stores inbound message, returns AI reply unless handoff.
import { serve } from 'https://deno.land/std/http/server.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin, getAuthUserId, assertWorkspaceMember } from '../_shared/supabase.ts';
import { enforceMessageLimitsOrThrow, bumpUsageCounters } from '../_shared/usage.ts';
import { enforceRateLimit } from '../_shared/rate_limit.ts';

type Body = {
  workspace_id: string;
  channel_id: string;
  external_user_id: string;
  text: string;
  metadata?: Record<string, unknown>;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const { workspace_id, channel_id, external_user_id, text } = body ?? ({} as any);
    if (!workspace_id || !channel_id || !external_user_id || !text) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const supabase = getSupabaseAdmin();

    // Auth: dashboard JWT OR webhook secret
    const authHeader = req.headers.get('authorization');
    const webhookSecret = req.headers.get('x-tamm-webhook-secret');

    let actorUserId: string | null = null;
    if (authHeader) {
      const userId = await getAuthUserId(req);
      if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);
      actorUserId = userId;
      const ok = await assertWorkspaceMember({ supabase, workspaceId: workspace_id, userId });
      if (!ok) return jsonResponse({ error: 'Forbidden' }, 403);
    } else {
      // external webhook path
      const { data: ch } = await supabase
        .from('channels')
        .select('config')
        .eq('id', channel_id)
        .maybeSingle();
      const expected = ch?.config?.secret;
      if (!expected || !webhookSecret || String(expected) !== String(webhookSecret)) {
        return jsonResponse({ error: 'Invalid webhook secret' }, 401);
      }
    }

    // Basic rate limiting (per workspace + user/external id)
    const rlKey = actorUserId
      ? `ingest:${workspace_id}:user:${actorUserId}`
      : `ingest:${workspace_id}:external:${external_user_id}`;
    const rl = await enforceRateLimit({ key: rlKey, windowSeconds: 60, max: 60 });
    if (!rl.allowed) {
      return jsonResponse({ error: 'rate_limited', resetAt: rl.resetAt }, 429);
    }

    // find/create conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('channel_id', channel_id)
      .eq('external_user_id', external_user_id)
      .maybeSingle();

    let conversationId = existing?.id as string | undefined;

    if (!conversationId) {
      const { data: created, error: cErr } = await supabase
        .from('conversations')
        .insert({
          workspace_id,
          channel_id,
          external_user_id,
          status: 'open',
        })
        .select('*')
        .maybeSingle();
      if (cErr) throw cErr;
      conversationId = created?.id;
    }

    if (!conversationId) throw new Error('Failed to create conversation');

    // if handoff, store inbound but no AI
    if (existing && String(existing.status) === 'handoff') {
      await supabase.from('channel_messages').insert({
        workspace_id,
        channel_id,
        conversation_id: conversationId,
        direction: 'in',
        sender_type: 'customer',
        message_text: text,
        raw_payload: body.metadata ?? {},
      });
      await bumpUsageCounters(supabase, workspace_id, { in: 1 });
      return jsonResponse({ handoff: true, conversation_id: conversationId }, 200);
    }

    // insert inbound
    const { data: inMsg, error: inErr } = await supabase
      .from('channel_messages')
      .insert({
        workspace_id,
        channel_id,
        conversation_id: conversationId,
        direction: 'in',
        sender_type: 'customer',
        message_text: text,
        raw_payload: body.metadata ?? {},
      })
      .select('id')
      .maybeSingle();
    if (inErr) throw inErr;

    await bumpUsageCounters(supabase, workspace_id, { in: 1 });


    // enforce plan message limits before generating AI reply
    try {
      await enforceMessageLimitsOrThrow(supabase, workspace_id);
    } catch (e: any) {
      return jsonResponse(
        {
          blocked: true,
          code: e?.code ?? 'PLAN_LIMIT',
          message: e?.message ?? 'Plan limit reached',
          tier: e?.tier,
          limits: e?.limits,
          usage: e?.usage,
          conversation_id: conversationId,
        },
        429
      );
    }

    // route agent
    const routeResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/route_agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        workspace_id,
        channel_id,
        conversation_id: conversationId,
        last_user_text: text,
      }),
    });

    const routeJson = await routeResp.json();
    if (!routeResp.ok) {
      return jsonResponse({ error: routeJson?.error ?? 'route_agent failed' }, 500);
    }

    // run agent
    const runResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/run_agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        workspace_id,
        channel_id,
        conversation_id: conversationId,
        agent_id: routeJson.agent_id,
        intent: routeJson.intent,
        last_user_text: text,
      }),
    });

    const runJson = await runResp.json();
    if (!runResp.ok) {
      return jsonResponse({ error: runJson?.error ?? 'run_agent failed' }, 500);
    }

    return jsonResponse({
      reply: runJson.reply ?? null,
      handoff: runJson.handoff ?? false,
      conversation_id: conversationId,
      message_id: inMsg?.id ?? null,
    }, 200);
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
