import { createChatCompletion, createEmbeddings } from './openai.ts';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatOptions = {
  temperature?: number;
  maxTokens?: number;
};

export interface LLMProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  embed(texts: string[]): Promise<number[][]>;
  name: string;
}

class OpenAIProvider implements LLMProvider {
  name = 'openai';

  constructor(private apiKey: string) {}

  async chat(messages: ChatMessage[], options?: ChatOptions) {
    return await createChatCompletion({
      apiKey: this.apiKey,
      model: 'gpt-4o-mini',
      messages,
      temperature: options?.temperature ?? 0.4,
      maxTokens: options?.maxTokens ?? 800,
    });
  }

  async embed(texts: string[]) {
    const resp = await createEmbeddings({
      apiKey: this.apiKey,
      model: 'text-embedding-3-small',
      input: texts,
    });
    return resp.data.map((d) => d.embedding);
  }
}

export function getProvider(): LLMProvider {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY env var.');
  // TODO: read provider strategy from internal admin table (tamm_admins/settings).
  return new OpenAIProvider(apiKey);
}
