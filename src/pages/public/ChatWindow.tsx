import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useChat } from "ai/react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ChatWindow() {
  const { agentId } = useParams();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get("mode") === "embed";

  const [agentName, setAgentName] = useState("Chat");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authHeaders, setAuthHeaders] = useState<HeadersInit | undefined>();

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    error,
  } = useChat({
    api: "/functions/v1/run_agent",
    body: {
      agent_id: agentId,
      session_id: sessionId,
    },
    headers: authHeaders,
  });

  useEffect(() => {
    let active = true;
    async function loadAgent() {
      if (!agentId || !isSupabaseConfigured) return;
      const { data, error } = await supabase
        .from("agents")
        .select("name")
        .eq("id", agentId)
        .single();

      if (!active) return;
      if (!error && data?.name) {
        setAgentName(data.name);
      }
    }

    void loadAgent();
    return () => {
      active = false;
    };
  }, [agentId]);

  useEffect(() => {
    const key = agentId ? `chat_session_${agentId}` : "chat_session_default";
    const existing = localStorage.getItem(key);
    if (existing) {
      setSessionId(existing);
      return;
    }

    const newSessionId = crypto.randomUUID();
    localStorage.setItem(key, newSessionId);
    setSessionId(newSessionId);
  }, [agentId]);

  useEffect(() => {
    let active = true;
    async function loadHeaders() {
      if (!isSupabaseConfigured) return;
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const accessToken = data?.session?.access_token;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      } else if (anonKey) {
        headers.apikey = anonKey;
      }

      setAuthHeaders(headers);
    }

    void loadHeaders();
    return () => {
      active = false;
    };
  }, []);

  const avatarLetter = useMemo(() => agentName.charAt(0).toUpperCase(), [agentName]);

  const handleFormSubmit = (event?: FormEvent<HTMLFormElement>) => {
    if (!agentId || !sessionId) {
      event?.preventDefault();
      return;
    }
    void handleSubmit(event);
  };

  return (
    <div
      className={`bg-background text-foreground flex flex-col ${
        isEmbed ? "h-full w-full" : "h-screen w-screen"
      }`}
    >
      {!isEmbed && (
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center">
            {avatarLetter}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{agentName}</p>
            <p className="text-xs text-muted-foreground">Powered by Tamm</p>
          </div>
        </header>
      )}

      <main
        className={`flex-1 overflow-y-auto bg-muted/30 space-y-3 ${
          isEmbed ? "p-3" : "p-4"
        }`}
      >
        {!agentId ? (
          <div className="text-sm text-muted-foreground">
            Missing agent. Please provide a valid agent ID.
          </div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Ask a question to start the conversation.
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === "assistant" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "assistant"
                    ? "bg-primary text-primary-foreground"
                    : "bg-white shadow-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {error ? <p className="text-xs text-destructive">{error.message}</p> : null}
      </main>

      <footer className={`border-t bg-background ${isEmbed ? "p-2" : "p-3"}`}>
        <form className="flex gap-2" onSubmit={handleFormSubmit}>
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={!agentId || !sessionId || isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleFormSubmit();
              }
            }}
          />
          {isLoading ? (
            <Button type="button" variant="secondary" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!agentId || !sessionId || isLoading || !input.trim()}
            >
              Send
            </Button>
          )}
        </form>
      </footer>
    </div>
  );
}
