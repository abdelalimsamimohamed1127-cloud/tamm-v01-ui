import { useState, useRef } from 'react';
import { runAgentStream, AgentRuntimeRequest } from '@/lib/agentRuntime';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

export function useAgentChat(agentId: string, mode: "live" | "preview", sessionId: string) { // Added mode and sessionId
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Hi! What can I help you with?' },
  ]);
  const [isSending, setIsSending] = useState(false);

  // Use a ref to hold the current streaming assistant message content
  const streamingAssistantMessageContentRef = useRef<string>('');

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setIsSending(true);
    const userMessage: Msg = { role: 'user', content: trimmed };
    // Add user message
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    // Add a placeholder for the assistant's streaming response
    const placeholderAssistantMessage: Msg = { role: 'assistant', content: '' };
    setMessages((prevMessages) => [...prevMessages, placeholderAssistantMessage]);

    streamingAssistantMessageContentRef.current = ''; // Reset for new message

    const request: AgentRuntimeRequest = {
      agent_id: agentId,
      message: trimmed,
      session_id: sessionId, // Use passed sessionId
      mode: mode, // Use passed mode
    };


    try {
      await runAgentStream(request, (event) => {
        if (event.type === "token" && event.content) {
          streamingAssistantMessageContentRef.current += event.content;
          // Update the content of the *last* message (which is the streaming assistant message)
          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: streamingAssistantMessageContentRef.current,
            };
            return newMessages;
          });
        } else if (event.type === "error" && event.content) {
          console.error("Error from agent runtime:", event.content);
          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            // Update the last message to show the error
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: `Error: ${event.content}`,
            };
            return newMessages;
          });
        }
      });
    } catch (e) {
      console.error("Unhandled error in useAgentChat sendMessage:", e);
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          content: 'Error contacting agent. Please try again.',
        };
        return newMessages;
      });
    } finally {
      setIsSending(false);
    }
  };

  return { messages, sendMessage, isSending };
}
