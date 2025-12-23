import { useMemo, useState } from "react";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Activity, MessageSquare, Database } from "lucide-react";

interface AgentRow {
  id: string;
  name: string;
  email: string;
}

type UsageStats = {
  totalMessages: number;
  messageLimit: number;
  aiTokens: number;
  activeAgents: number;
};

const seedAgents: AgentRow[] = [
  { id: "agt_001", name: "Default Agent", email: "agent@workspace.com" },
  { id: "agt_002", name: "Support Bot", email: "support@workspace.com" },
];

export default function ManageAgentsDialogContent() {
  const [agents, setAgents] = useState<AgentRow[]>(seedAgents);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [usage, setUsage] = useState<UsageStats>({
    totalMessages: 0,
    messageLimit: 0,
    aiTokens: 0,
    activeAgents: seedAgents.length,
  });

  const canCreate = useMemo(() => name.trim() && email.trim(), [name, email]);

  const addAgent = () => {
    if (!canCreate) return;
    setAgents((prev) => [
      ...prev,
      { id: `agt_${String(prev.length + 1).padStart(3, "0")}`, name: name.trim(), email: email.trim() },
    ]);
    setName("");
    setEmail("");
  };

  const renameAgent = (id: string, value: string) => {
    setAgents((prev) => prev.map((agent) => (agent.id === id ? { ...agent, name: value } : agent)));
  };

  const deleteAgent = (id: string) => {
    setAgents((prev) => prev.filter((agent) => agent.id !== id));
  };

  const fetchUsageStats = async (): Promise<UsageStats> => {
    // Mocked data for now; wire to real usage metrics later.
    return {
      totalMessages: 1250,
      messageLimit: 2000,
      aiTokens: 450_000,
      activeAgents: agents.length,
    };
  };

  useEffect(() => {
    void fetchUsageStats().then(setUsage);
  }, [agents.length]);

  return (
    <div className="w-full max-w-3xl">
      <ScrollArea className="h-[70vh] pr-2">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Manage agents</h2>
            <p className="text-sm text-muted-foreground">Create, rename, or remove agents for this workspace.</p>
          </div>

          <Tabs defaultValue="agents" className="w-full">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="agents">Agents</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>

            <TabsContent value="agents" className="pt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Create agent</CardTitle>
                  <CardDescription>Add a new agent with name and email (UI only).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input placeholder="Agent name" value={name} onChange={(e) => setName(e.target.value)} />
                    <Input placeholder="Agent email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={addAgent} disabled={!canCreate}>
                      Create agent
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Agents</CardTitle>
                  <CardDescription>Update names or remove agents. Actions are UI-only.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {agents.map((agent) => (
                    <div key={agent.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Input
                              value={agent.name}
                              onChange={(e) => renameAgent(agent.id, e.target.value)}
                              className="w-48"
                            />
                            <Badge variant="secondary">{agent.id}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{agent.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" disabled>
                            Rename
                          </Button>
                          <Button variant="destructive" onClick={() => deleteAgent(agent.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                      <Separator />
                      <p className="text-xs text-muted-foreground">Preview only. Saving is not wired to backend yet.</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="usage" className="pt-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="h-full">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Total Messages</CardTitle>
                      <CardDescription>{`${usage.totalMessages} / ${usage.messageLimit}`}</CardDescription>
                    </div>
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Progress value={(usage.totalMessages / Math.max(usage.messageLimit, 1)) * 100} />
                    <p className="text-xs text-muted-foreground">
                      {Math.round((usage.totalMessages / Math.max(usage.messageLimit, 1)) * 100)}% of quota
                    </p>
                  </CardContent>
                </Card>

                <Card className="h-full">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">AI Tokens</CardTitle>
                      <CardDescription>Approx. cost estimate</CardDescription>
                    </div>
                    <Database className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold">{usage.aiTokens.toLocaleString()} tokens</p>
                    <p className="text-xs text-muted-foreground">Mock data (read-only)</p>
                  </CardContent>
                </Card>

                <Card className="h-full">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Active Agents</CardTitle>
                      <CardDescription>Current seats in use</CardDescription>
                    </div>
                    <Activity className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold">{usage.activeAgents}</p>
                    <p className="text-xs text-muted-foreground">Read-only preview</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
