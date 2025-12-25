// Supabase Edge Function: webhooks/whatsapp/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.5";

console.log("Hello from WhatsApp Webhook Edge Function!");

// Assuming environment variables are set in Supabase project settings
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '';
const DJANGO_API_URL = Deno.env.get("DJANGO_API_URL") ?? ''; // Base URL of your Django backend
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? ''; // For WhatsApp webhook verification

serve(async (req) => {
  if (req.method === "GET") {
    // WhatsApp webhook verification
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("Webhook verified!");
      return new Response(challenge, { status: 200 });
    } else {
      return new Response("Verification token mismatch", { status: 403 });
    }
  } else if (req.method === "POST") {
    try {
      // 1. Verify Webhook Signature (Placeholder for actual implementation)
      // For production, you would verify the X-Hub-Signature header
      // This step is critical for security to ensure the webhook comes from Meta.
      // Deno.env.get("WHATSAPP_APP_SECRET") would be used here.
      console.log("Webhook received. Signature verification skipped for MVP.");

      const payload = await req.json();
      console.log("WhatsApp Payload:", JSON.stringify(payload, null, 2));

      // Initialize Supabase client with service role key (bypasses RLS)
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // --- Extract and Normalize Message ---
      // This is a simplified extraction for a text message from a typical WhatsApp webhook.
      // Real-world scenarios need robust parsing for different message types, media, etc.
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];
      const contacts = change?.value?.contacts?.[0];

      if (!message || message.type !== "text") {
        console.log("No text message found or message type not supported.");
        return new Response("No text message or unsupported type", { status: 200 });
      }

      const external_user_id = message.from; // WhatsApp user ID
      const message_content = message.text.body;
      const whatsapp_message_id = message.id; // WhatsApp's own message ID

      // --- Assume a default Workspace and Agent for MVP ---
      // In a real system, you'd resolve these from the channel/number mapping
      // For now, hardcode or retrieve from environment/DB for simplicity
      const WORKSPACE_ID = Deno.env.get("DEFAULT_WORKSPACE_ID") || "YOUR_DEFAULT_WORKSPACE_UUID";
      const AGENT_ID = Deno.env.get("DEFAULT_AGENT_ID") || "YOUR_DEFAULT_AGENT_UUID";

      // 2. Canonical Message Schema
      const canonicalMessage = {
        workspace_id: WORKSPACE_ID,
        agent_id: AGENT_ID,
        channel: "whatsapp",
        external_user_id: external_user_id,
        direction: "inbound",
        message_type: "text",
        content: message_content,
        raw_payload: payload, // Store raw payload for debugging/future parsing
        external_message_id: whatsapp_message_id, // Store WhatsApp's message ID
      };

      // 3. Insert message into Supabase (agent_chat_messages)
      const { data, error } = await supabaseAdmin.from("agent_chat_messages").insert([
        canonicalMessage
      ]).select("id").single(); // Select the ID of the newly inserted message

      if (error) {
        console.error("Error inserting message into Supabase:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }

      const supabase_message_id = data.id;
      console.log(`Message ${supabase_message_id} inserted into Supabase.`);

      // 4. Decide and Forward Event to Django
      // For MVP, assume AI should always respond for inbound WhatsApp messages
      const djangoEventPayload = {
        event: "message_received",
        workspace_id: WORKSPACE_ID,
        agent_id: AGENT_ID,
        message_id: supabase_message_id, // Pass the Supabase-generated message ID
        channel: "whatsapp",
        external_user_id: external_user_id,
        message: {
          type: "text",
          content: message_content
        }
      };

      // Assume a specific endpoint in Django for handling channel events
      const djangoEventEndpoint = `${DJANGO_API_URL}/api/v1/channels/event`;
      
      // Need a JWT for Django authentication
      // For system-to-system calls, generate a short-lived JWT or use an internal API key
      // For now, mocking system JWT. In real scenario, use a specific JWT with limited scope.
      const SYSTEM_DJANGO_AUTH_TOKEN = Deno.env.get("DJANGO_SYSTEM_AUTH_TOKEN") || "YOUR_SYSTEM_DJANGO_AUTH_TOKEN"; // This needs to be a valid JWT that Django's SupabaseJWTAuthentication can verify

      const djangoResponse = await fetch(djangoEventEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SYSTEM_DJANGO_AUTH_TOKEN}`,
          "X-Workspace-ID": WORKSPACE_ID, // Django middleware needs this
        },
        body: JSON.stringify(djangoEventPayload),
      });

      if (!djangoResponse.ok) {
        const errorBody = await djangoResponse.text();
        console.error(`Failed to forward event to Django: ${djangoResponse.status} - ${errorBody}`);
        // Consider logging to a separate error tracking system
        return new Response(JSON.stringify({ error: "Failed to forward event to Django" }), { status: 500 });
      }

      console.log("Event forwarded to Django successfully.");
      return new Response("OK", { status: 200 });

    } catch (error) {
      console.error("Error processing WhatsApp webhook:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
  return new Response("Method Not Allowed", { status: 405 });
});
