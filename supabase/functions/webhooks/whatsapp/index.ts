// Supabase Edge Function: webhooks/whatsapp/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase/supabase-js@2.38.5"; // Corrected import to use supabase-js@2
import { writeAuditLog, captureError } from "../_shared/observability.ts"; // Import audit logging
import { jsonResponse } from "../_shared/cors.ts"; // For consistent response utility

console.log("Hello from WhatsApp Webhook Edge Function!");

// Assuming environment variables are set in Supabase project settings
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '';
const DJANGO_API_URL = Deno.env.get("DJANGO_API_URL") ?? ''; // Base URL of your Django backend
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? ''; // For WhatsApp webhook verification

serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse("ok", 200); // Using jsonResponse for consistency

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let workspaceId: string | undefined; // To store workspace_id for audit logging

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token) {
        // Query for a channel with the matching verify_token
        const { data, error } = await supabaseAdmin
          .from('agent_channels')
          .select('id, workspace_id') // Select workspace_id for audit
          .eq('platform', 'whatsapp_cloud')
          .eq('config->>verify_token', token)
          .limit(1)
          .single();

        if (error || !data) {
          console.error("Webhook verification failed: token not found or db error.", error);
          await captureError({
            where: "whatsapp_webhook_verification",
            error: new Error("Verification token mismatch or DB error"),
            metadata: { token_attempted: token },
          });
          return jsonResponse("Verification token mismatch", 403);
        }
        
        workspaceId = data.workspace_id; // Set workspaceId for audit
        console.log("Webhook verified successfully!");
        await writeAuditLog({
          workspace_id: workspaceId,
          actor_user_id: null,
          action: "webhook_verification_successful",
          entity_type: "whatsapp_channel",
          entity_id: data.id,
          metadata: { token_used: token },
        });
        return new Response(challenge, { status: 200 });

      } else {
        await captureError({
          where: "whatsapp_webhook_verification",
          error: new Error("Invalid verification request"),
          metadata: { mode, token_from_hub: token },
        });
        return jsonResponse("Invalid request", 400);
      }
    } else if (req.method === "POST") {
      const request_id = req.headers.get("X-Request-ID") || crypto.randomUUID(); // Generate unique request ID

      const bodyText = await req.text();
      const payload = JSON.parse(bodyText);
      console.log("WhatsApp Payload:", JSON.stringify(payload, null, 2));

      // Attempt to extract workspace_id early for audit logging
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const metadata = change?.value?.metadata;
      const message = change?.value?.messages?.[0];
      const phone_number_id = metadata?.phone_number_id;

      // 1. Resolve Channel Configuration to get workspace_id
      if (phone_number_id) {
        const { data: channelData } = await supabaseAdmin
          .from('agent_channels')
          .select('workspace_id, agent_id, config')
          .eq('platform', 'whatsapp_cloud')
          .eq('config->>phone_number_id', phone_number_id)
          .neq('status', 'disconnected')
          .limit(1)
          .single();
        if (channelData) {
          workspaceId = channelData.workspace_id;
        }
      }

      // Log webhook received BEFORE processing to ensure it's always recorded
      await writeAuditLog({
        workspace_id: workspaceId || "unknown", // Use "unknown" if workspace_id can't be resolved yet
        actor_user_id: null,
        action: "webhook_received",
        entity_type: "whatsapp_webhook",
        metadata: {
          request_id: request_id,
          source: "whatsapp",
          phone_number_id: phone_number_id,
          payload_summary: {
            // Include a summary to avoid logging full raw_payload in audit log
            object: payload.object,
            entry_id: payload.entry?.[0]?.id,
            changes_field: payload.entry?.[0]?.changes?.[0]?.field,
          },
        },
      });

      if (!message || !metadata) {
        console.log("Not a message payload, ignoring.");
        return jsonResponse("OK", 200);
      }
      
      // Ensure workspaceId is resolved for subsequent logging
      const { data: channel, error: channelError } = await supabaseAdmin
        .from('agent_channels')
        .select('workspace_id, agent_id, config')
        .eq('platform', 'whatsapp_cloud')
        .eq('config->>phone_number_id', phone_number_id)
        .neq('status', 'disconnected')
        .limit(1)
        .single();

      if (channelError || !channel) {
        console.warn(`Channel not found for phone_number_id: ${phone_number_id}. Ignoring.`, channelError);
        await captureError({
          where: "whatsapp_webhook_processing",
          error: new Error(`Channel not found for phone_number_id: ${phone_number_id}`),
          workspace_id: workspaceId,
          metadata: { request_id: request_id, phone_number_id: phone_number_id },
        });
        return jsonResponse("Channel not configured", 200);
      }
      workspaceId = channel.workspace_id; // Ensure workspaceId is set

      // 2. Verify Webhook Signature
      const app_secret_ref = channel.config?.app_secret_ref;
      if (!app_secret_ref) {
        console.error(`app_secret_ref not found for channel with phone_number_id: ${phone_number_id}`);
        await captureError({
          where: "whatsapp_webhook_processing",
          error: new Error("Internal configuration error: app_secret_ref missing"),
          workspace_id: workspaceId,
          metadata: { request_id: request_id, phone_number_id: phone_number_id },
        });
        return jsonResponse("Internal configuration error", 200);
      }
      
      const appSecret = Deno.env.get(app_secret_ref);
      if (!appSecret) {
        console.error(`Secret for ref ${app_secret_ref} not found in environment.`);
        await captureError({
          where: "whatsapp_webhook_processing",
          error: new Error("Internal configuration error: appSecret missing from env"),
          workspace_id: workspaceId,
          metadata: { request_id: request_id, app_secret_ref: app_secret_ref },
        });
        return jsonResponse("Internal configuration error", 200);
      }

      const signature = req.headers.get("X-Hub-Signature-256") || "";
      const expectedSignature = await createHmacSha256(appSecret, bodyText);

      if (signature !== `sha256=${expectedSignature}`) {
        console.warn("Signature mismatch. Rejecting request.");
        await writeAuditLog({
          workspace_id: workspaceId,
          actor_user_id: null,
          action: "signature_failed",
          entity_type: "whatsapp_webhook",
          metadata: { request_id: request_id, signature_received: signature, phone_number_id: phone_number_id },
        });
        return jsonResponse("Signature mismatch", 403);
      }
      console.log("Signature verified successfully.");

      // 3. Idempotency Check
      const whatsapp_message_id = message.id;
      const { data: existingMessage, error: idempotencyError } = await supabaseAdmin
        .from('agent_chat_messages')
        .select('id')
        .eq('external_message_id', whatsapp_message_id)
        .limit(1)
        .single();
      
      if (idempotencyError && idempotencyError.code !== 'PGRST116') { // PGRST116 is "No rows found"
        console.error("Idempotency check failed with db error:", idempotencyError);
        await captureError({
          where: "whatsapp_webhook_idempotency",
          error: idempotencyError,
          workspace_id: workspaceId,
          metadata: { request_id: request_id, whatsapp_message_id: whatsapp_message_id },
        });
        return jsonResponse("Database error", 500);
      }

      if (existingMessage) {
        console.log(`Duplicate message ID received: ${whatsapp_message_id}. Ignoring.`);
        await writeAuditLog({
          workspace_id: workspaceId,
          actor_user_id: null,
          action: "webhook_duplicate_received",
          entity_type: "whatsapp_webhook",
          entity_id: existingMessage.id, // Reference existing message if possible
          metadata: { request_id: request_id, whatsapp_message_id: whatsapp_message_id },
        });
        return jsonResponse("Duplicate message", 200);
      }

      // 4. Normalize and Insert Message
      if (message.type !== "text") {
        console.log(`Unsupported message type: ${message.type}. Ignoring.`);
        return jsonResponse("Unsupported message type", 200);
      }

      const { agent_id } = channel;
      const canonicalMessage = {
        workspace_id: workspaceId,
        agent_id,
        channel: "whatsapp_cloud",
        external_user_id: message.from,
        direction: "inbound",
        message_type: "text",
        content: message.text.body,
        raw_payload: payload,
        external_message_id: whatsapp_message_id,
      };

      const { data: insertedMessage, error: insertError } = await supabaseAdmin
        .from("agent_chat_messages")
        .insert([canonicalMessage])
        .select("id")
        .single();

      if (insertError) {
        console.error("Error inserting message into Supabase:", insertError);
        await captureError({
          where: "whatsapp_webhook_insert",
          error: insertError,
          workspace_id: workspaceId,
          metadata: { request_id: request_id, whatsapp_message_id: whatsapp_message_id },
        });
        return jsonResponse(JSON.stringify({ error: insertError.message }), 500);
      }
      console.log(`Message ${insertedMessage.id} inserted.`);
      await writeAuditLog({
        workspace_id: workspaceId,
        actor_user_id: null,
        action: "message_inserted",
        entity_type: "agent_chat_message",
        entity_id: insertedMessage.id,
        metadata: { request_id: request_id, whatsapp_message_id: whatsapp_message_id, channel: "whatsapp_cloud" },
      });

      // 5. Forward Event to Django
      const djangoEventPayload = {
        event: "message_received",
        workspace_id,
        agent_id,
        message_id: insertedMessage.id,
        channel: "whatsapp_cloud",
        message: {
          type: "text",
          content: message.text.body,
        },
      };

      const djangoEventEndpoint = `${DJANGO_API_URL}/api/v1/channels/event`;
      const SYSTEM_DJANGO_AUTH_TOKEN = Deno.env.get("DJANGO_SYSTEM_AUTH_TOKEN");

      if (!SYSTEM_DJANGO_AUTH_TOKEN) {
        await captureError({
            where: "whatsapp_webhook_django_forward",
            error: new Error("DJANGO_SYSTEM_AUTH_TOKEN is not set."),
            workspace_id: workspaceId,
            metadata: { request_id: request_id, message_id: insertedMessage.id },
        });
        return jsonResponse("Internal configuration error", 500);
      }

      const djangoResponse = await fetch(djangoEventEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SYSTEM_DJANGO_AUTH_TOKEN}`,
          "X-Workspace-ID": workspaceId,
        },
        body: JSON.stringify(djangoEventPayload),
      });

      if (!djangoResponse.ok) {
        const errorBody = await djangoResponse.text();
        console.error(`Failed to forward event to Django: ${djangoResponse.status} - ${errorBody}`);
        await captureError({
          where: "whatsapp_webhook_django_forward",
          error: new Error(`Django forwarding failed: ${djangoResponse.status} - ${errorBody}`),
          workspace_id: workspaceId,
          metadata: { request_id: request_id, message_id: insertedMessage.id, django_status: djangoResponse.status },
        });
        return jsonResponse(JSON.stringify({ error: "Failed to forward event" }), 500);
      }

      console.log("Event forwarded to Django successfully.");
      return jsonResponse("OK", 200);

    } catch (error) {
      console.error("Error processing WhatsApp webhook:", error);
      await captureError({
        where: "whatsapp_webhook_global_catch",
        error: error,
        workspace_id: workspaceId,
        metadata: { request_id: req.headers.get("X-Request-ID") }, // Use original request_id if available
      });
      return jsonResponse(JSON.stringify({ error: (error as Error).message }), 500);
    }
  }
  return jsonResponse("Method Not Allowed", 405);
});

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
