import { useEffect, useMemo, useState } from "react";
import { Pie, PieChart, Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";

import { useWorkspace } from "@/hooks/useWorkspace";
import { getAgentUsage, getChannelUsage, getDailyBurn, type AgentUsage, type ChannelUsage, type DailyCreditBurn } from "@/services/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "#22c55e",
  webchat: "#3b82f6",
  messenger: "#a855f7",
  email: "#6b7280",
};

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
];

function formatDate(input: string | null | undefined) {
  if (!input) return "-";
  const date = new Date(input);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CtfUsagePanel() {
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [agentUsage, setAgentUsage] = useState<AgentUsage[]>([]);
  const [channelUsage, setChannelUsage] = useState<ChannelUsage[]>([]);
  const [dailyBurn, setDailyBurn] = useState<DailyCreditBurn[]>([]);
  const [selectedRange, setSelectedRange] = useState<number>(RANGE_OPTIONS[0]?.value ?? 7);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      if (!workspace?.id) return;

      setIsLoading(true);
      setError(null);

      try {
        const [agents, channels, burn] = await Promise.all([
          getAgentUsage(workspace.id),
          getChannelUsage(workspace.id),
          getDailyBurn(workspace.id, selectedRange),
        ]);

        setAgentUsage(agents ?? []);
        setChannelUsage(channels ?? []);
        setDailyBurn(burn ?? []);
      } catch (err) {
        console.error("Failed to load credit usage analytics", err);
        setError("Unable to load credit usage analytics right now.");
        setAgentUsage([]);
        setChannelUsage([]);
        setDailyBurn([]);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchAnalytics();
  }, [workspace?.id, selectedRange]);

  const sortedDailyBurn = useMemo(
    () => [...dailyBurn].sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()),
    [dailyBurn],
  );

  if (isWorkspaceLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Usage</CardTitle>
          <CardDescription>Loading workspace...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-36 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!workspace) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Credit Usage</h2>
        <p className="text-sm text-muted-foreground">Visibility into how credits are consumed by agents and channels.</p>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Credit Usage</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Usage per Agent</CardTitle>
            <CardDescription>Sorted by credits used.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, idx) => (
                  <Skeleton key={idx} className="h-9 w-full" />
                ))}
              </div>
            ) : agentUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent Name</TableHead>
                      <TableHead className="text-right">Credits Used</TableHead>
                      <TableHead className="text-right">Usage Events</TableHead>
                      <TableHead className="text-right">Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentUsage.map((row) => (
                      <TableRow key={row.agent_id}>
                        <TableCell className="font-medium">{row.agent_name}</TableCell>
                        <TableCell className="text-right">{row.credits_used.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.usage_events.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatDate(row.last_usage_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage per Channel</CardTitle>
            <CardDescription>Share of credits by channel.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-56 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : channelUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No channel usage yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelUsage}
                      dataKey="credits_used"
                      nameKey="channel"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {channelUsage.map((entry) => (
                        <Cell
                          key={entry.channel}
                          fill={CHANNEL_COLORS[entry.channel.toLowerCase()] ?? "#94a3b8"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `${Number(value || 0).toLocaleString()} credits`}
                      wrapperClassName="text-sm"
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Daily Credit Burn</CardTitle>
            <CardDescription>Credits consumed per day.</CardDescription>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border p-1">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={selectedRange === option.value ? "default" : "ghost"}
                onClick={() => setSelectedRange(option.value)}
                disabled={isLoading}
                className="px-3"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : sortedDailyBurn.length === 0 ? (
            <p className="text-sm text-muted-foreground">No credit burn recorded for this range.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sortedDailyBurn} margin={{ left: 12, right: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(value) => formatDate(value)} tickLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(value: number) => `${Number(value || 0).toLocaleString()} credits`} />
                  <Legend />
                  <Line type="monotone" dataKey="credits_used" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CtfUsagePanel;
