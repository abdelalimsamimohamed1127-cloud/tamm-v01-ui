import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";

export default function AgentHeader({
  loading,
  agentName,
  onSave,
}: {
  loading: boolean;
  agentName: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(agentName);

  useEffect(() => setName(agentName), [agentName]);

  return (
    <div className="flex items-center justify-between border-b bg-background px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold">AI Agent</h1>
        <p className="text-sm text-muted-foreground">
          Configure your agent settings, knowledge base, and test it safely.
        </p>
      </div>

      <div className="flex gap-2 items-center">
        <Input
          className="w-64"
          placeholder="Agent name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
        <Button onClick={() => onSave(name)} disabled={loading || !name.trim()}>
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
}