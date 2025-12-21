import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { chatWithAgent } from '@/lib/kb';
import { Loader2 } from 'lucide-react';

export default function AgentPlayground({ agentId }: { agentId: string }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user'|'assistant'; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await chatWithAgent(agentId, msg);
      setMessages((m) => [...m, { role: 'assistant', text: res.reply }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Error: ' + (e?.message ?? String(e)) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Playground</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="border rounded-md p-3 h-[280px] overflow-auto space-y-2 bg-background">
          {messages.length === 0 ? (
            <div className="text-sm text-muted-foreground">Try asking about your catalog or sources.</div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div className="inline-block max-w-[90%] rounded-md px-3 py-2 text-sm border">
                  {m.text}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message…" className="min-h-[44px]" />
          <Button onClick={send} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
