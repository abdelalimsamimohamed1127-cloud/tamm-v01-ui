import { supabase } from '@/lib/supabase'

type StreamHandler = (chunk: string) => void

export async function sendMessageToAgent(
  agentId: string,
  message: string,
  sessionId: string,
  onChunk: StreamHandler,
): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const accessToken = data?.session?.access_token ?? null
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  } else if (anonKey) {
    headers.apikey = anonKey
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/run_agent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agent_id: agentId,
      message,
      session_id: sessionId,
    }),
  })

  if (!response.ok) {
    throw new Error('Network response was not ok')
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    if (text) onChunk(text)
  }

  const finalText = decoder.decode()
  if (finalText) onChunk(finalText)
}
