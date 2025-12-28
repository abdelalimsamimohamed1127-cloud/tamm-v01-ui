import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";

import { useWorkspace } from "@/hooks";
import { getDailyStats, type DailyStat } from "@/services";
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
  messages_count: {
    label: "Total Messages",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

function fillMissingDays(data: DailyStat[], startDate: Date, days: number): DailyStat[] {
    const dataMap = new Map(data.map(item => [item.date.split('T')[0], item]));
    const result: DailyStat[] = [];
    const cursor = new Date(startDate);

    for (let i = 0; i < days; i++) {
        const dateKey = cursor.toISOString().split('T')[0];
        if (dataMap.has(dateKey)) {
            result.push(dataMap.get(dateKey)!);
        } else {
            result.push({
                date: dateKey,
                conversations_count: 0,
                messages_count: 0,
                orders_count: 0,
                revenue_total: 0,
            });
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return result;
}

export default function Analytics() {
  const { workspace: activeWorkspace } = useWorkspace();
  const [selectedRange, setSelectedRange] = useState<number>(RANGE_OPTIONS[0]?.value ?? 7);
  
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
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

      try {
        const stats = await getDailyStats(activeWorkspace.id, rangeStartDate.toISOString());
        const filledStats = fillMissingDays(stats, rangeStartDate, selectedRange);
        setDailyStats(filledStats);
      } catch (requestError) {
        console.error("Failed to load analytics", requestError);
        setError("Unable to load analytics data right now. Please try again later.");
        setDailyStats([]);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchAnalytics();
  }, [activeWorkspace?.id, rangeStartDate, selectedRange]);

  const { totalMessages, totalConversations, totalRevenue } = useMemo(() => {
    return dailyStats.reduce(
      (acc, stat) => {
        acc.totalMessages += stat.messages_count;
        acc.totalConversations += stat.conversations_count;
        acc.totalRevenue += stat.revenue_total;
        return acc;
      },
      { totalMessages: 0, totalConversations: 0, totalRevenue: 0 }
    );
  }, [dailyStats]);

  const chartData = useMemo(() => {
    return dailyStats.map(stat => ({
        date: new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        messages_count: stat.messages_count,
    }));
  }, [dailyStats]);

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

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Analytics unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Messages</CardDescription>
            <CardTitle className="text-2xl">{totalMessages.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Conversations</CardDescription>
            <CardTitle className="text-2xl">{totalConversations.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl">${totalRevenue.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <CardTitle>Daily Message Volume</CardTitle>
          <CardDescription>Total messages sent by users and agents per day.</CardDescription>
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
                <Bar dataKey="messages_count" fill="var(--color-messages_count)" radius={[4, 4, 0, 0]} />
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
