import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

export default function AgentPlayground({
  loading,
  agentId,
  onSend,
}: {
  loading: boolean;
  agentId: string | null;
  onSend: (messages: { role: "user" | "assistant" | "system"; content: string }[]) => Promise<string>;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const disabled = loading || !agentId || sending;

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    const next = [...messages, { role: "user", content: text } as Msg];
    setMessages(next);
    setSending(true);

    try {
      const payload = next.map((m) => ({ role: m.role, content: m.content }));
      const reply = await onSend(payload);
      setMessages((prev) => [...prev, { role: "assistant", content: reply || "(empty reply)" }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="flex flex-col h-[70vh]">
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Send a message to test your agent. It will retrieve from your knowledge base.
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] rounded-lg p-3 text-sm ${
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      <div className="border-t p-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Test your agent..."
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <Button onClick={handleSend} disabled={disabled || !input.trim()}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
        </Button>
      </div>
    </Card>
  );
}