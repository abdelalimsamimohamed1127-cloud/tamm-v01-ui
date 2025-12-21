import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import OpenAI from 'https://esm.sh/openai@4.57.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { agent_id, message } = await req.json();
    if (!agent_id || !message) return new Response(JSON.stringify({ error: 'missing agent_id/message' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are Tamm AI Agent. Answer briefly and helpfully.' },
        { role: 'user', content: String(message) },
      ],
      temperature: 0.2,
    });

    const reply = completion.choices?.[0]?.message?.content ?? '';
    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
