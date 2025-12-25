// Import necessary libraries
import { createClient } from '@supabase/supabase-js'
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import * as crypto from 'https://deno.land/std@0.188.0/crypto/mod.ts';

// Supabase and other environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const messengerVerifyToken = Deno.env.get('MESSENGER_VERIFY_TOKEN')!
const messengerAppSecret = Deno.env.get('MESSENGER_APP_SECRET')!
const tammApiUrl = Deno.env.get('TAMM_API_URL')!
const tammApiKey = Deno.env.get('TAMM_API_KEY')!

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
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${supabaseAnonKey}` } },
  });
  
  const url = new URL(req.url);

  try {
    // --- PART 1: Webhook Verification (GET) ---
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === messengerVerifyToken) {
        console.log('Webhook verification successful!');
        return new Response(challenge, { status: 200 });
      } else {
        console.error('Webhook verification failed.');
        return new Response('Forbidden', { status: 403 });
      }
    }

    // --- PART 2: Handle Incoming Messages (POST) ---
    if (req.method === 'POST') {
      // 1. Verify Signature
      const signature = req.headers.get('X-Hub-Signature-256');
      if (!signature) {
        throw new Error("Missing 'X-Hub-Signature-256' header");
      }
      
      const bodyText = await req.text();
      const expectedSignature = await createHmacSha256(messengerAppSecret, bodyText);

      if (signature !== `sha256=${expectedSignature}`) {
        throw new Error('Signature mismatch');
      }

      // 2. Parse Payload
      const body = JSON.parse(bodyText);

      if (body.object !== 'page') {
        return new Response('Not a page object', { status: 200 });
      }

      for (const entry of body.entry) {
        for (const messagingEvent of entry.messaging) {
          await processMessage(messagingEvent, supabase);
        }
      }

      return new Response('ok', { status: 200 });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (error) {
    console.error('Error processing request:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
})

async function processMessage(messagingEvent: MessengerEvent, supabase) {
    if (!messagingEvent.message || !messagingEvent.sender) {
        console.log('Ignoring non-message event:', messagingEvent);
        return;
    }
    
    // 3. Extract key information
    const external_user_id = messagingEvent.sender.id; // User's PSID
    const page_id = messagingEvent.recipient.id; // Your Page's ID
    
    // --- Find Workspace and Agent ID from Supabase ---
    // A channel is uniquely identified by the provider and the provider-specific ID (page_id for messenger)
    const { data: channelData, error: channelError } = await supabase
        .from('agent_channels')
        .select('agent_id, workspace_id')
        .eq('provider', 'messenger')
        .eq('provider_config', page_id) // Assuming page_id is stored in provider_config
        .single();
        
    if (channelError || !channelData) {
        throw new Error(`Channel config not found for page_id ${page_id}. Error: ${channelError?.message}`);
    }
    
    const { agent_id, workspace_id } = channelData;
    
    // 4. Map to Canonical Schema
    let message_type: 'text' | 'image' | 'audio' = 'text';
    let content = '';

    if (messagingEvent.message.text) {
        content = messagingEvent.message.text;
    } else if (messagingEvent.message.attachments) {
        const attachment = messagingEvent.message.attachments[0];
        message_type = attachment.type === 'image' || attachment.type === 'audio' ? attachment.type : 'text'; // Fallback for unsupported types
        content = attachment.payload.url || 'Unsupported attachment type';
    } else {
        console.log("Ignoring event with no text or attachments.");
        return;
    }

    const canonicalMessage: CanonicalMessage = {
        workspace_id,
        agent_id,
        channel: 'messenger',
        external_user_id,
        direction: 'inbound',
        message_type,
        content,
        raw_payload: messagingEvent as Record<string, unknown>,
        created_at: new Date(messagingEvent.timestamp).toISOString(),
    };
    
    // 5. Insert into Supabase
    const { data: insertedMessage, error: insertError } = await supabase
      .from('agent_chat_messages')
      .insert(canonicalMessage)
      .select('id')
      .single();

    if (insertError) {
        throw new Error(`Failed to insert message into Supabase: ${insertError.message}`);
    }
    console.log(`Inserted message ${insertedMessage.id} for workspace ${workspace_id}`);
    
    // 6. Forward event to Django
    await forwardEventToDjango({
        event: 'message_received',
        workspace_id,
        agent_id,
        message_id: insertedMessage.id,
        channel: 'messenger'
    });
}

async function forwardEventToDjango(payload: { workspace_id: string, [key: string]: unknown }) {
    const response = await fetch(`${tammApiUrl}/api/v1/channels/event`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tammApiKey}`,
            'X-Workspace-ID': payload.workspace_id,
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