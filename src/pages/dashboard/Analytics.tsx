import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CtfUsagePanel } from "@/components/analytics/CtfUsagePanel";

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
];

const chartConfig = {
  user_messages: {
    label: "User messages",
    color: "hsl(var(--chart-1))",
  },
  ai_messages: {
    label: "AI messages",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

type MessageRow = {
  created_at: string;
  role: string | null;
  session_id?: string | null;
  user_id?: string | null;
};

type DailyStatRow = {
  date: string;
  user_messages?: number | null;
  ai_messages?: number | null;
  total_messages?: number | null;
};

type UsageEventRow = {
  created_at?: string | null;
  cost_usd?: number | null;
};

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildEmptyRange(startDate: Date, days: number) {
  const buckets = new Map<string, { user_messages: number; ai_messages: number }>();
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i += 1) {
    const dateKey = formatDateKey(cursor);
    buckets.set(dateKey, { user_messages: 0, ai_messages: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function aggregateMessages(
  messages: MessageRow[],
  startDate: Date,
  days: number,
): { date: string; user_messages: number; ai_messages: number }[] {
  const buckets = buildEmptyRange(startDate, days);

  messages.forEach((message) => {
    if (!message.created_at) return;

    const dateKey = message.created_at.slice(0, 10);
    if (!buckets.has(dateKey)) return;

    const bucket = buckets.get(dateKey);
    if (!bucket) return;

    const role = (message.role || "").toLowerCase();
    if (role === "assistant" || role === "ai" || role === "model") {
      bucket.ai_messages += 1;
    } else {
      bucket.user_messages += 1;
    }
  });

  return Array.from(buckets.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));
}

export default function Analytics() {
  const [selectedRange, setSelectedRange] = useState<number>(RANGE_OPTIONS[0]?.value ?? 7);
  const [totalMessages, setTotalMessages] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [chartData, setChartData] = useState<{ date: string; user_messages: number; ai_messages: number }[]>([]);
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
      setIsLoading(true);
      setError(null);

      const startDateIso = rangeStartDate.toISOString();

      try {
        const [messagesRes, usageEventsRes, dailyStatsRes] = await Promise.all([
          supabase
            .from("chat_messages")
            .select("created_at, role, session_id, user_id")
            .gte("created_at", startDateIso)
            .order("created_at", { ascending: true }),
          supabase.from("usage_events").select("cost_usd, created_at").gte("created_at", startDateIso),
          supabase
            .from("daily_stats")
            .select("date, user_messages, ai_messages, total_messages")
            .gte("date", startDateIso)
            .order("date", { ascending: true }),
        ]);

        if (messagesRes.error) {
          throw messagesRes.error;
        }

        const messageRows = (messagesRes.data as MessageRow[]) ?? [];
        setTotalMessages(messageRows.length);

        const uniqueUsers = new Set<string>();
        messageRows.forEach((message) => {
          const identifier = message.session_id || message.user_id;
          if (identifier) {
            uniqueUsers.add(identifier);
          }
        });
        setActiveUsers(uniqueUsers.size);

        if (usageEventsRes.error) {
          throw usageEventsRes.error;
        }

        const usageEvents = (usageEventsRes.data as UsageEventRow[]) ?? [];
        const cost = usageEvents.reduce((sum, event) => sum + Number(event.cost_usd ?? 0), 0);
        setEstimatedCost(cost);

        let nextChartData: { date: string; user_messages: number; ai_messages: number }[] = [];

        if (!dailyStatsRes.error && dailyStatsRes.data && dailyStatsRes.data.length > 0) {
          const dailyRows = dailyStatsRes.data as DailyStatRow[];
          nextChartData = buildEmptyRange(rangeStartDate, selectedRange)
            .entries()
            .map(([date]) => {
              const dailyRow = dailyRows.find((row) => row.date?.slice(0, 10) === date);
              const userMessages = Number(dailyRow?.user_messages ?? 0);
              const aiMessages =
                dailyRow?.ai_messages !== undefined && dailyRow?.ai_messages !== null
                  ? Number(dailyRow.ai_messages)
                  : Math.max(0, Number(dailyRow?.total_messages ?? 0) - userMessages);

              return {
                date,
                user_messages: userMessages,
                ai_messages: aiMessages,
              };
            });
        } else {
          nextChartData = aggregateMessages(messageRows, rangeStartDate, selectedRange);
        }

        setChartData(nextChartData);
      } catch (requestError) {
        console.error("Failed to load analytics", requestError);
        setError("Unable to load analytics data right now. Please try again later.");
        setTotalMessages(0);
        setActiveUsers(0);
        setEstimatedCost(0);
        setChartData([]);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchAnalytics();
  }, [rangeStartDate, selectedRange]);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">General Analytics</h1>
          <p className="text-sm text-muted-foreground">Operational overview of your AI agents.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border p-1">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={selectedRange === option.value ? "default" : "ghost"}
              className="px-3"
              onClick={() => setSelectedRange(option.value)}
              disabled={isLoading}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Analytics unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Messages</CardDescription>
            <CardTitle className="text-2xl">{totalMessages.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Users</CardDescription>
            <CardTitle className="text-2xl">{activeUsers.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated Cost</CardDescription>
            <CardTitle className="text-2xl">${estimatedCost.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <CardTitle>Daily Message Volume</CardTitle>
          <CardDescription>Breakdown of user and AI messages per day.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading analytics...</span>
            </div>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No message activity for this range.</p>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-[16/7]">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="user_messages" fill="var(--color-user_messages)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ai_messages" fill="var(--color-ai_messages)" radius={[4, 4, 0, 0]} />
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <CtfUsagePanel />
    </div>
  );
}
