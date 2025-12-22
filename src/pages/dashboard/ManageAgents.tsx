import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentRow {
  id: string;
  name: string;
  lastTrained: string;
}

const agents: AgentRow[] = [
  { id: "agt_001", name: "Default Agent", lastTrained: "Updated 2h ago" },
  { id: "agt_002", name: "Support Bot", lastTrained: "Updated yesterday" },
  { id: "agt_003", name: "Sales Concierge", lastTrained: "Updated 3d ago" },
];

const sideNav = [
  { label: "Agents", active: true },
  { label: "Usage", active: false },
  { label: "Workspace settings", active: false, children: ["General", "Members", "Plans", "Billing"] },
];

export default function ManageAgents() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Navigation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sideNav.map((item) => (
            <div key={item.label} className="space-y-1">
              <button
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition",
                  item.active && "bg-muted font-semibold"
                )}
              >
                {item.label}
              </button>
              {item.children && (
                <div className="ml-3 space-y-1">
                  {item.children.map((child) => (
                    <button
                      key={child}
                      className="w-full rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted transition"
                    >
                      {child}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-sm text-muted-foreground">Manage your agents and training recency.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <Card
              key={agent.id}
              onMouseEnter={() => setHovered(agent.id)}
              onMouseLeave={() => setHovered(null)}
              className="transition hover:border-primary/40"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription>{agent.lastTrained}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Rename</DropdownMenuItem>
                      <DropdownMenuItem>Retrain</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{agent.id}</Badge>
                  <span className={cn("text-xs text-muted-foreground", hovered === agent.id && "text-primary")}>
                    • Active
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />
        <p className="text-xs text-muted-foreground">Actions are UI-only. Training and edits are not connected to backend yet.</p>
      </div>
    </div>
  );
}
