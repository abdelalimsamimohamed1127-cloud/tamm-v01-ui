import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AgentRow {
  id: string;
  name: string;
  email: string;
}

const seedAgents: AgentRow[] = [
  { id: "agt_001", name: "Default Agent", email: "agent@workspace.com" },
  { id: "agt_002", name: "Support Bot", email: "support@workspace.com" },
];

export default function ManageAgentsDialogContent() {
  const [agents, setAgents] = useState<AgentRow[]>(seedAgents);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

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
              <Card>
                <CardHeader>
                  <CardTitle>Usage overview</CardTitle>
                  <CardDescription>Mock usage metrics for this workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Messages used</p>
                      <p className="text-xs text-muted-foreground">1,240 / 5,000</p>
                    </div>
                    <Badge variant="secondary">24.8%</Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Storage</p>
                      <p className="text-xs text-muted-foreground">45% of plan quota</p>
                    </div>
                    <Badge variant="outline" className="text-emerald-700">
                      Healthy
                    </Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Active agents</p>
                      <p className="text-xs text-muted-foreground">2 / 10 seats</p>
                    </div>
                    <Badge variant="secondary">Seats available</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
