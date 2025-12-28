import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatMessage, chatWithAgent, loadChatHistory } from '@/lib/kb';
import { Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks'; // Import useWorkspace hook

export default function AgentPlayground({ agentId }: { agentId: string }) {
  const { workspace } = useWorkspace(); // Get workspace from context
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined); // State to hold current session ID

  // Load chat history when component mounts or agentId/sessionId changes
  useEffect(() => {
    if (sessionId) {
      const fetchHistory = async () => {
        setLoading(true);
        try {
          const history = await loadChatHistory(sessionId);
          setMessages(history);
        } catch (e) {
          console.error('Failed to load chat history:', e);
          // Optionally, display an error message in UI
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    } else {
      setMessages([]); // Clear messages if no session
      setCurrentAssistantMessage('');
    }
  }, [sessionId]); // Dependency on sessionId

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading || !workspace?.id) return; // Ensure workspaceId exists

    const userMessage: ChatMessage = {
      id: '', // Will be set by backend after persistence
      session_id: sessionId || '', // Placeholder, actual set by backend if new
      role: 'user',
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMessage]);
    setInput('');
    setCurrentAssistantMessage(''); // Clear previous assistant message
    setLoading(true);

    let fullAssistantResponse = '';
    const onToken = (token: string) => {
      fullAssistantResponse += token;
      setCurrentAssistantMessage(fullAssistantResponse);
    };

    const onSessionIdReceived = (newSessionId: string) => {
      if (!sessionId) { // Only set if it's the first time receiving it for this session
        setSessionId(newSessionId);
        // Update the user message in state with the correct session_id
        setMessages(prevMessages => prevMessages.map(msg => 
          msg.role === 'user' && msg.content === userMessage.content && msg.id === ''
            ? { ...msg, session_id: newSessionId }
            : msg
        ));
      }
    };

    try {
      const result = await chatWithAgent(
        workspace.id,
        agentId,
        msg,
        onToken,
        onSessionIdReceived,
        sessionId
      );

      if (result.success) {
        setMessages((m) => [
          ...m,
          {
            id: '', // Backend will set
            session_id: sessionId || result.sessionId || '', // Use current or received sessionId
            role: 'assistant',
            content: fullAssistantResponse,
            tokens_used: result.tokens_used,
            created_at: new Date().toISOString(),
          },
        ]);
        setCurrentAssistantMessage(''); // Clear current streaming message
      } else {
        setMessages((m) => [...m, { id: '', session_id: sessionId || '', role: 'assistant', content: 'Error: ' + (result.error || 'Unknown error'), created_at: new Date().toISOString() }]);
        setCurrentAssistantMessage('');
      }
    } catch (e: any) {
      setMessages((m) => [...m, { id: '', session_id: sessionId || '', role: 'assistant', content: 'Error: ' + (e?.message ?? String(e)), created_at: new Date().toISOString() }]);
      setCurrentAssistantMessage('');
    } finally {
      setLoading(false);
    }
  }, [input, loading, workspace?.id, agentId, sessionId]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Playground</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="border rounded-md p-3 flex-1 overflow-auto space-y-2 bg-background mb-3">
          {messages.length === 0 && !currentAssistantMessage ? (
            <div className="text-sm text-muted-foreground">Try asking about your catalog or sources.</div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div className="inline-block max-w-[90%] rounded-md px-3 py-2 text-sm border">
                  {m.content}
                </div>
              </div>
            ))
          )}
          {currentAssistantMessage && (
            <div className="text-left">
              <div className="inline-block max-w-[90%] rounded-md px-3 py-2 text-sm border bg-secondary">
                {currentAssistantMessage}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Type a message…" 
            className="min-h-[44px]" 
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
