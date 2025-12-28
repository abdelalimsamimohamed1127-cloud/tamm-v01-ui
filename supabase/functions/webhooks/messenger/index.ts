// Import necessary libraries
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import * as crypto from 'https://deno.land/std@0.188.0/crypto/mod.ts';
import { writeAuditLog, captureError } from "../_shared/observability.ts"; // Import audit logging
import { jsonResponse } from "../_shared/cors.ts"; // For consistent response utility

// Supabase and other environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Use service role key
const tammApiUrl = Deno.env.get('TAMM_API_URL')!

// --- TYPES ---
// Based on the required canonical message schema
interface CanonicalMessage {
  workspace_id: string;
  agent_id: string;
  channel: 'messenger';
  external_user_id: string;
  direction: 'inbound';
  message_type: 'text' | 'image' | 'audio';
  content: string;
  raw_payload: Record<string, unknown>;
  created_at: string;
}

// Simplified Messenger webhook payload structure
interface MessengerEvent {
  sender: { id: string };
  recipient: { id:string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: { type: 'image' | 'audio' | 'video' | 'file'; payload: { url: string } }[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse("ok", 200);

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, { // Use service role client
    global: { headers: { Authorization: `Bearer ${supabaseServiceRoleKey}` } },
  });
  
  const url = new URL(req.url);
  let workspaceId: string | undefined; // To store workspace_id for audit logging

  try {
    // --- PART 1: Webhook Verification (GET) ---
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const tokenFromHub = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && tokenFromHub) {
        const { data: channels, error } = await supabaseAdmin
          .from('agent_channels')
          .select('config, workspace_id') // Select workspace_id for audit
          .eq('platform', 'messenger')
          .neq('status', 'disconnected');

        if (error) {
            console.error("DB error fetching messenger channels for verification:", error);
            await captureError({
                where: "messenger_webhook_verification",
                error: error,
                metadata: { token_attempted: tokenFromHub },
            });
            return jsonResponse("Forbidden", 403);
        }
        
        let verified = false;
        if (channels) {
            for (const channel of channels) {
                const verifyTokenRef = channel.config?.verify_token_ref;
                if (verifyTokenRef) {
                    const storedToken = Deno.env.get(verifyTokenRef);
                    if (storedToken && storedToken === tokenFromHub) {
                        verified = true;
                        workspaceId = channel.workspace_id; // Set workspace_id for audit
                        break;
                    }
                }
            }
        }

        if (verified) {
            console.log('Webhook verification successful!');
            await writeAuditLog({
                workspace_id: workspaceId || "unknown",
                actor_user_id: null,
                action: "webhook_verification_successful",
                entity_type: "messenger_channel",
                metadata: { token_used: tokenFromHub },
            });
            return new Response(challenge, { status: 200 });
        } else {
            console.error("Webhook verification failed: no matching token found for any active messenger channel.");
            await captureError({
                where: "messenger_webhook_verification",
                error: new Error("No matching token found"),
                metadata: { token_attempted: tokenFromHub },
            });
            return jsonResponse("Forbidden", 403);
        }
      } else {
        console.error('Webhook verification failed: mode or token missing.');
        await captureError({
            where: "messenger_webhook_verification",
            error: new Error("Mode or token missing"),
            metadata: { mode, token_from_hub: tokenFromHub },
        });
        return jsonResponse('Forbidden', 403);
      }
    }

    // --- PART 2: Handle Incoming Messages (POST) ---
    if (req.method === 'POST') {
      const request_id = req.headers.get("X-Request-ID") || crypto.randomUUID(); // Generate unique request ID

      const bodyText = await req.text();
      const payload = JSON.parse(bodyText);

      // Attempt to extract workspace_id early for audit logging
      const entry = payload.entry?.[0];
      const page_id = entry?.id;

      if (page_id) {
        const { data: channelData } = await supabaseAdmin
          .from('agent_channels')
          .select('workspace_id')
          .eq('platform', 'messenger')
          .eq('config->>page_id', page_id)
          .neq('status', 'disconnected')
          .limit(1)
          .single();
        if (channelData) {
          workspaceId = channelData.workspace_id;
        }
      }

      // Log webhook received BEFORE processing to ensure it's always recorded
      await writeAuditLog({
        workspace_id: workspaceId || "unknown",
        actor_user_id: null,
        action: "webhook_received",
        entity_type: "messenger_webhook",
        metadata: {
          request_id: request_id,
          source: "messenger",
          page_id: page_id,
          payload_summary: {
            object: payload.object,
            entry_id: payload.entry?.[0]?.id,
          },
        },
      });

      if (!page_id) {
        console.warn("Received payload without page ID. Ignoring.");
        return jsonResponse("OK", 200);
      }

      const { data: channel, error: channelError } = await supabaseAdmin
        .from('agent_channels')
        .select('workspace_id, agent_id, config')
        .eq('platform', 'messenger')
        .eq('config->>page_id', page_id)
        .neq('status', 'disconnected')
        .limit(1)
        .single();
        
      if (channelError || !channel) {
        console.warn(`Channel not found for page_id: ${page_id}. Ignoring.`, channelError);
        await captureError({
            where: "messenger_webhook_processing",
            error: new Error(`Channel not found for page_id: ${page_id}`),
            workspace_id: workspaceId,
            metadata: { request_id: request_id, page_id: page_id },
        });
        return jsonResponse("OK", 200);
      }
      workspaceId = channel.workspace_id; // Ensure workspaceId is set

      const app_secret_ref = channel.config?.app_secret_ref;
      if (!app_secret_ref) {
        console.error(`app_secret_ref not found for page_id: ${page_id}`);
        await captureError({
            where: "messenger_webhook_processing",
            error: new Error("Internal configuration error: app_secret_ref missing"),
            workspace_id: workspaceId,
            metadata: { request_id: request_id, page_id: page_id },
        });
        return jsonResponse("Internal configuration error", 200);
      }
      
      const appSecret = Deno.env.get(app_secret_ref);
      if (!appSecret) {
        console.error(`Secret for ref ${app_secret_ref} not found in environment.`);
        await captureError({
            where: "messenger_webhook_processing",
            error: new Error("Internal configuration error: appSecret missing from env"),
            workspace_id: workspaceId,
            metadata: { request_id: request_id, app_secret_ref: app_secret_ref },
        });
        return jsonResponse("Internal configuration error", 200);
      }

      const signature = req.headers.get('X-Hub-Signature-256') || "";
      const expectedSignature = await createHmacSha256(appSecret, bodyText);

      if (signature !== `sha256=${expectedSignature}`) {
        console.warn("Signature mismatch. Rejecting request.");
        await writeAuditLog({
            workspace_id: workspaceId,
            actor_user_id: null,
            action: "signature_failed",
            entity_type: "messenger_webhook",
            metadata: { request_id: request_id, signature_received: signature, page_id: page_id },
        });
        return jsonResponse("Signature mismatch", 403);
      }
      console.log("Signature verified successfully for page_id:", page_id);

      for (const messagingEvent of entry.messaging) {
        if (!messagingEvent.message || !messagingEvent.sender || messagingEvent.message.is_echo) {
            console.log('Ignoring non-message, echo, or sender-less event.');
            continue;
        }

        const message_id = messagingEvent.message.mid;
        const { data: existingMessage, error: idempotencyError } = await supabaseAdmin
            .from('agent_chat_messages')
            .select('id')
            .eq('external_message_id', message_id)
            .limit(1)
            .single();

        if (idempotencyError && idempotencyError.code !== 'PGRST116') {
            console.error("Idempotency check db error:", idempotencyError);
            await captureError({
                where: "messenger_webhook_idempotency",
                error: idempotencyError,
                workspace_id: workspaceId,
                metadata: { request_id: request_id, message_id: message_id },
            });
            continue;
        }

        if (existingMessage) {
            console.log(`Duplicate message ID: ${message_id}. Ignoring.`);
            await writeAuditLog({
                workspace_id: workspaceId,
                actor_user_id: null,
                action: "webhook_duplicate_received",
                entity_type: "messenger_webhook",
                entity_id: existingMessage.id,
                metadata: { request_id: request_id, message_id: message_id, page_id: page_id },
            });
            continue;
        }

        try {
            const insertedMessageId = await processMessage(messagingEvent, channel, supabaseAdmin, request_id);
            if (insertedMessageId) {
                await writeAuditLog({
                    workspace_id: workspaceId,
                    actor_user_id: null,
                    action: "message_inserted",
                    entity_type: "agent_chat_message",
                    entity_id: insertedMessageId,
                    metadata: { request_id: request_id, message_id: message_id, channel: "messenger" },
                });
            }
        } catch (msgProcessError) {
            console.error("Error processing single Messenger message:", msgProcessError);
            await captureError({
                where: "messenger_webhook_message_process",
                error: msgProcessError,
                workspace_id: workspaceId,
                metadata: { request_id: request_id, message_mid: messagingEvent.message?.mid },
            });
        }
      }

      return jsonResponse('ok', 200);
    }

    return jsonResponse('Method Not Allowed', 405);
  } catch (error) {
    console.error('Error processing request:', error);
    await captureError({
      where: "messenger_webhook_global_catch",
      error: error,
      workspace_id: workspaceId,
      metadata: { request_id: req.headers.get("X-Request-ID") },
    });
    return jsonResponse(JSON.stringify({ error: (error as Error).message }), 500);
  }
})

async function processMessage(messagingEvent, channel, supabase, request_id): Promise<string | null> {
    const { agent_id, workspace_id } = channel;
    
    let message_type: 'text' | 'image' | 'audio' = 'text';
    let content = '';

    if (messagingEvent.message.text) {
        content = messagingEvent.message.text;
    } else if (messagingEvent.message.attachments) {
        const attachment = messagingEvent.message.attachments[0];
        message_type = attachment.type === 'image' || attachment.type === 'audio' ? attachment.type : 'text';
        content = attachment.payload.url || 'Unsupported attachment type';
    } else {
        console.log("Ignoring event with no text or attachments.");
        return null;
    }

    const canonicalMessage = {
        workspace_id,
        agent_id,
        channel: 'messenger',
        external_user_id: messagingEvent.sender.id,
        direction: 'inbound',
        message_type,
        content,
        raw_payload: messagingEvent as Record<string, unknown>,
        created_at: new Date(messagingEvent.timestamp).toISOString(),
        external_message_id: messagingEvent.message.mid,
    };
    
    const { data: insertedMessage, error: insertError } = await supabase
      .from('agent_chat_messages')
      .insert(canonicalMessage)
      .select('id')
      .single();

    if (insertError) {
        throw new Error(`Failed to insert message into Supabase: ${insertError.message}`);
    }
    console.log(`Inserted message ${insertedMessage.id} for workspace ${workspace_id}`);
    
    // Forward event to Django
    try {
        await forwardEventToDjango({
            event: 'message_received',
            workspace_id,
            agent_id,
            message_id: insertedMessage.id,
            channel: 'messenger'
        }, request_id, workspace_id); // Pass request_id and workspace_id for Django audit
    } catch (djangoError) {
        throw new Error(`Failed to forward event to Django: ${(djangoError as Error).message}`);
    }
    return insertedMessage.id;
}

async function forwardEventToDjango(payload: { workspace_id: string, [key: string]: unknown }, request_id: string, workspace_id: string) {
    const SYSTEM_DJANGO_AUTH_TOKEN = Deno.env.get("DJANGO_SYSTEM_AUTH_TOKEN");
    if (!SYSTEM_DJANGO_AUTH_TOKEN) {
      throw new Error("DJANGO_SYSTEM_AUTH_TOKEN is not set.");
    }
    
    const response = await fetch(`${tammApiUrl}/api/v1/channels/event`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SYSTEM_DJANGO_AUTH_TOKEN}`,
            'X-Workspace-ID': payload.workspace_id,
            'X-Request-ID': request_id, // Pass request_id to Django
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to forward event to Django. Status: ${response.status}. Body: ${errorBody}`);
    }
    console.log('Successfully forwarded event to Django.');
}

async function createHmacSha256(secret: string, data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}