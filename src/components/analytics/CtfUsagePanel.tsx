import { useEffect, useMemo, useState } from "react";
import { Pie, PieChart, Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";

import { useWorkspace } from "@/hooks";
import { getAgentPerformance, getChannelActivity, getUsageEvents, type AgentPerformance, type ChannelActivity, type DailyUsage } from "@/services";
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
  instagram: "#ec4899",
  telegram: "#38bdf8"
};

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
];

function formatDate(input: string | null | undefined) {
  if (!input) return "-";
  const date = new Date(input);
  // Adjust for timezone to avoid off-by-one day errors
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CtfUsagePanel() {
  const { workspace: activeWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [channelActivity, setChannelActivity] = useState<ChannelActivity[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [selectedRange, setSelectedRange] = useState<number>(RANGE_OPTIONS[0]?.value ?? 7);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rangeStartDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (selectedRange - 1));
    return start;
  }, [selectedRange]);

  useEffect(() => {
    async function fetchAnalytics() {
      if (!activeWorkspace?.id) return;

      setIsLoading(true);
      setError(null);
      const startDateIso = rangeStartDate.toISOString();

      try {
        const [agents, channels, usage] = await Promise.all([
          getAgentPerformance(activeWorkspace.id, startDateIso),
          getChannelActivity(activeWorkspace.id, startDateIso),
          getDailyUsage(activeWorkspace.id, startDateIso),
        ]);

        setAgentPerformance(agents ?? []);
        setChannelActivity(channels ?? []);
        setDailyUsage(usage ?? []);
      } catch (err) {
        console.error("Failed to load usage analytics", err);
        setError("Unable to load usage analytics right now.");
        setAgentPerformance([]);
        setChannelActivity([]);
        setDailyUsage([]);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchAnalytics();
  }, [activeWorkspace?.id, selectedRange, rangeStartDate]);

  const sortedDailyUsage = useMemo(
    () => [...dailyUsage].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [dailyUsage],
  );

  if (isWorkspaceLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detailed Analytics</CardTitle>
          <CardDescription>Loading workspace...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-36 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Performance Details</h2>
        <p className="text-sm text-muted-foreground">Breakdown of performance by agent and channel.</p>
      </div>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Analytics Details</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Performance per Agent</CardTitle>
            <CardDescription>Sorted by total messages handled.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, idx) => (
                  <Skeleton key={idx} className="h-9 w-full" />
                ))}
              </div>
            ) : agentPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agent performance recorded yet.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Messages</TableHead>
                      <TableHead className="text-right">Sessions</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentPerformance.map((row) => (
                      <TableRow key={row.agent_id}>
                        <TableCell className="font-medium">{row.agent_name}</TableCell>
                        <TableCell className="text-right">{row.total_messages.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.sessions_count.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${row.revenue_generated.toFixed(2)}</TableCell>
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
            <CardTitle>Activity by Channel</CardTitle>
            <CardDescription>Share of messages by channel.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-56 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : channelActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No channel activity yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelActivity}
                      dataKey="message_count"
                      nameKey="channel_platform"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {channelActivity.map((entry) => (
                        <Cell
                          key={entry.channel_platform}
                          fill={CHANNEL_COLORS[entry.channel_platform.toLowerCase()] ?? "#94a3b8"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `${Number(value || 0).toLocaleString()} messages`}
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
            <CardTitle>Daily Usage Events</CardTitle>
            <CardDescription>Total usage events processed per day.</CardDescription>
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
          ) : sortedDailyUsage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage recorded for this range.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sortedDailyUsage} margin={{ left: 12, right: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} tickLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(value: number) => `${Number(value || 0).toLocaleString()} events`} />
                  <Legend />
                  <Line name="Usage Events" type="monotone" dataKey="quantity" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
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
