import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function AgentSettings({
  loading,
  systemPrompt,
  onSave,
}: {
  loading: boolean;
  systemPrompt: string;
  onSave: (prompt: string) => Promise<void>;
}) {
  const [value, setValue] = useState(systemPrompt);

  useEffect(() => setValue(systemPrompt), [systemPrompt]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Prompt</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={10}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Define how your agent should behave..."
          disabled={loading}
        />
        <div className="flex justify-end">
          <Button onClick={() => onSave(value)} disabled={loading}>
            Save Prompt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}