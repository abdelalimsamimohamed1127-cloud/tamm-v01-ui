type EmbeddingResponse = { data: Array<{ embedding: number[] }> };

export async function createEmbeddings(params: {
  apiKey: string;
  model: string;
  input: string[];
}) {
  const { apiKey, model, input } = params;

  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI embeddings failed: ${resp.status} ${text}`);
  }

  const json = (await resp.json()) as EmbeddingResponse;
  return json.data.map((d) => d.embedding);
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function createChatCompletion(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxOutputTokens: number;
}) {
  const { apiKey, model, messages, temperature, maxOutputTokens } = params;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxOutputTokens,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI chat failed: ${resp.status} ${text}`);
  }

  const json = await resp.json();
  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.delta?.content ??
    '';
  return String(content);
}

export function estimateTokens(text: string) {
  // Rough heuristic for English/Arabic: ~4 chars/token
  return Math.ceil(text.length / 4);
}
