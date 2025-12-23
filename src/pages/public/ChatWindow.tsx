import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { chatWithAgent } from "@/lib/kb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatWindow() {
  const { agentId } = useParams();
  const [agentName, setAgentName] = useState("Chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

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

  const avatarLetter = useMemo(() => agentName.charAt(0).toUpperCase(), [agentName]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !agentId || sending) return;

    const nextMessages = [...messages, { role: "user", content: text } as Message];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const reply = await chatWithAgent(agentId, text);
      setMessages((prev) => [...prev, { role: "assistant", content: reply.reply || "" }]);
    } catch (error: any) {
      const description = error?.message || "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", content: description }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center">
          {avatarLetter}
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{agentName}</p>
          <p className="text-xs text-muted-foreground">Powered by Tamm</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
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
            <div key={idx} className="flex">
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-white shadow-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
      </main>

      <footer className="border-t bg-background p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={!agentId || sending}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button onClick={() => void handleSend()} disabled={!agentId || sending || !input.trim()}>
            {sending ? "Sending..." : "Send"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
