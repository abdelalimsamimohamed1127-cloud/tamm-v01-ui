import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function SettingsGeneral() {
  const { workspace } = useWorkspace();
  const agentId = useMemo(() => workspace?.id ?? "agent_12345", [workspace?.id]);
  const [agentName, setAgentName] = useState(workspace?.name ?? "My Agent");
  const [creditLimitEnabled, setCreditLimitEnabled] = useState(false);
  const [creditLimit, setCreditLimit] = useState("500");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your agent configuration and limits.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent details</CardTitle>
          <CardDescription>Update your agent basics and identifiers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent-id">Agent ID</Label>
              <Input id="agent-id" value={agentId} readOnly className="bg-muted/60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent name</Label>
              <Input
                id="agent-name"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Enter agent name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credit limit</CardTitle>
          <CardDescription>Control spending caps for this agent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Enable credit limit</p>
              <p className="text-xs text-muted-foreground">Toggle to enforce a maximum credit usage.</p>
            </div>
            <Switch checked={creditLimitEnabled} onCheckedChange={setCreditLimitEnabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="credit-limit">Limit amount</Label>
            <Input
              id="credit-limit"
              type="number"
              min="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              disabled={!creditLimitEnabled}
              placeholder="0"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>Permanent actions for this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delete messages</p>
                <p className="text-xs text-muted-foreground">Remove all messages for this agent.</p>
              </div>
              <Button variant="destructive" disabled>
                Delete messages
              </Button>
            </div>
            <Separator />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete all conversations</p>
              <p className="text-xs text-muted-foreground">Clear every conversation linked to this agent.</p>
            </div>
            <Button variant="destructive" disabled>
              Delete conversations
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
