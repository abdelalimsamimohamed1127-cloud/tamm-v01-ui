import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

export function useAgentChat(agentId: string) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Hi! What can I help you with?' },
  ]);
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setIsSending(true);
    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);

    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: { agent_id: agentId, messages: nextMessages },
      });

      if (error) throw error;

      const reply = data?.reply ?? 'Sorry, no reply.';
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Error contacting agent. Please try again.' },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return { messages, sendMessage, isSending };
}