import React, { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Smile, Send, RotateCcw } from "lucide-react";
import { useAgent } from '@/hooks/useAgent';
import { useAgentChat } from '@/hooks/useAgentChat'; // Import useAgentChat hook

interface AgentPlaygroundProps {
  agentId: string;
  interactionsDisabled: boolean; // Prop from parent to disable interactions
  mode: "live" | "preview"; // NEW PROP: mode
}

type Message = { role: 'user' | 'assistant'; content: string; id: string };

export const AgentPlayground: React.FC<AgentPlaygroundProps> = ({ agentId, interactionsDisabled, mode }) => {
  const { activeAgent } = useAgent();
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Use the useAgentChat hook
  const { messages, sendMessage, isSending, resetChat: resetAgentChatHistory } = useAgentChat(agentId, mode, sessionId || ''); // Pass mode and sessionId

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize session ID from local storage or generate new
  useEffect(() => {
    if (!agentId) return;
    const storageKey = `agent_playground_session_${mode}_${agentId}`; // Differentiate storage key by mode
    let currentSessionId = localStorage.getItem(storageKey);
    if (!currentSessionId) {
      currentSessionId = crypto.randomUUID();
      localStorage.setItem(storageKey, currentSessionId);
    }
    setSessionId(currentSessionId);
    // When agentId changes, clear messages in the useAgentChat hook
    resetAgentChatHistory(); // Reset chat history when agent or mode changes
  }, [agentId, mode, resetAgentChatHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]); // Scroll to bottom on new messages

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !agentId || !sessionId || isSending) return;

    await sendMessage(input); // Use sendMessage from useAgentChat
    setInput("");
  }, [input, agentId, sessionId, isSending, sendMessage]);

  const handleResetChat = useCallback(() => {
    // Generate a new session ID to start a fresh conversation
    const newSessionId = crypto.randomUUID();
    const storageKey = `agent_playground_session_${mode}_${agentId}`; // Differentiate storage key by mode
    localStorage.setItem(storageKey, newSessionId);
    setSessionId(newSessionId);
    resetAgentChatHistory(); // Reset chat history via useAgentChat
    setInput("");
  }, [agentId, mode, resetAgentChatHistory]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isSending && input.trim()) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <Card className="h-full flex flex-col rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Agent Playground</span>
          {mode === "preview" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-700/50">Preview mode – not live</span>
          )}
        </div>
        <button
          type="button"
          className="rounded-full p-2 hover:bg-white/10 transition"
          title="Reset"
          disabled={interactionsDisabled || isSending}
          onClick={handleResetChat}
        >
          <RotateCcw className="h-4 w-4 hover:rotate-180 transition" />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-3 bg-[radial-gradient(#d4d4d4_1px,transparent_1px)] [background-size:16px_16px] overflow-y-auto">
        {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                Start a conversation with {activeAgent?.name || "the agent"}
            </div>
        ) : (
            messages.map((m) => (
            <div
                key={m.id}
                className={`flex ${m.role === "assistant" ? "justify-end" : "justify-start"}`}
            >
                <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    m.role === "assistant"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-200 text-gray-800 rounded-bl-none"
                } shadow-sm animate-in fade-in slide-in-from-bottom-2`}
                >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
            </div>
            ))
        )}
        <div ref={messagesEndRef} /> {/* Scroll anchor */}
      </div>

      <div className="p-3 bg-white">
        <div className="flex items-center gap-2 rounded-full border px-3 py-2 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-shadow">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            className="border-0 focus-visible:ring-0"
            disabled={interactionsDisabled || isSending || !agentId}
          />
          <button
            type="button"
            className="rounded-full p-2 hover:bg-muted transition"
            title="Emoji"
            disabled={interactionsDisabled || isSending || !agentId}
          >
            <Smile className="h-5 w-5 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="rounded-full p-2 hover:bg-muted transition"
            title="Send"
            onClick={handleSendMessage}
            disabled={interactionsDisabled || isSending || !input.trim() || !agentId}
          >
            <Send className="h-5 w-5 hover:scale-110 transition" />
          </button>
        </div>
      </div>
    </Card>
  );
};
