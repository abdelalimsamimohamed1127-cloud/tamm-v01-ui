import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { CalendarRange, Filter } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export type ChatSessionSummary = {
  id: string;
  topic: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  urgency: "low" | "medium" | "high" | null;
  channel?: string | null;
  created_at?: string | null;
  external_user_id?: string | null;
  user_id?: string | null;
  session_id?: string | null;
};

type DateRange = {
  from: string;
  to: string;
};

type InsightsExplorerProps = {
  onSessionsChange?: (sessions: ChatSessionSummary[]) => void;
};

const SENTIMENT_SCORE: Record<string, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
};

const DEFAULT_CHANNEL_OPTIONS = [
  { label: "All channels", value: "all" },
  { label: "Webchat", value: "webchat" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Messenger", value: "messenger" },
];

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDefaultRange(): DateRange {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return { from: formatDateInput(start), to: formatDateInput(end) };
}

function normalizeTopic(topic: string | null) {
  return topic?.trim() ? topic.trim() : "Unclassified";
}

function normalizeSentiment(sentiment: string | null) {
  if (sentiment === "positive" || sentiment === "negative" || sentiment === "neutral") {
    return sentiment;
  }
  return "neutral";
}

function normalizeChannel(channel: string | null | undefined) {
  if (!channel) return "";
  return channel;
}

export default function InsightsExplorer({ onSessionsChange }: InsightsExplorerProps) {
  const [dateRange, setDateRange] = useState<DateRange>(buildDefaultRange());
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [topicOptions, setTopicOptions] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchSessions() {
      setIsLoading(true);
      try {
        const from = new Date(dateRange.from);
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
          .from("chat_sessions")
          .select(
            "id, topic, sentiment, urgency, channel, channel_id, created_at, external_user_id, user_id, session_id",
          )
          .gte("created_at", from.toISOString())
          .lte("created_at", to.toISOString())
          .order("created_at", { ascending: false });

        if (error) throw error;

        const mapped = (data ?? []).map((row: any) => ({
          id: String(row.id ?? ""),
          topic: row.topic ?? null,
          sentiment: row.sentiment ?? null,
          urgency: row.urgency ?? null,
          channel: row.channel ?? row.channel_id ?? null,
          created_at: row.created_at ?? null,
          external_user_id: row.external_user_id ?? null,
          user_id: row.user_id ?? null,
          session_id: row.session_id ?? null,
        })) as ChatSessionSummary[];

        setSessions(mapped);

        const uniqueTopics = new Set<string>();
        mapped.forEach((session) => uniqueTopics.add(normalizeTopic(session.topic)));
        setTopicOptions(Array.from(uniqueTopics.values()).sort());
      } catch (error) {
        console.error("Failed to load insights sessions", error);
        setSessions([]);
        setTopicOptions([]);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchSessions();
  }, [dateRange.from, dateRange.to]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const topic = normalizeTopic(session.topic);
      const channel = normalizeChannel(session.channel);

      const topicMatch = selectedTopics.length === 0 || selectedTopics.includes(topic);
      const channelMatch = selectedChannel === "all" || channel === selectedChannel;

      return topicMatch && channelMatch;
    });
  }, [sessions, selectedChannel, selectedTopics]);

  useEffect(() => {
    onSessionsChange?.(filteredSessions);
  }, [filteredSessions, onSessionsChange]);

  const topicChartData = useMemo(() => {
    const grouped = new Map<string, { count: number; sentimentTotal: number; sentimentCount: number }>();

    filteredSessions.forEach((session) => {
      const topic = normalizeTopic(session.topic);
      const sentiment = normalizeSentiment(session.sentiment);
      const current = grouped.get(topic) ?? { count: 0, sentimentTotal: 0, sentimentCount: 0 };
      current.count += 1;
      current.sentimentTotal += SENTIMENT_SCORE[sentiment];
      current.sentimentCount += 1;
      grouped.set(topic, current);
    });

    return Array.from(grouped.entries())
      .map(([topic, values]) => ({
        topic,
        count: values.count,
        avgSentiment: values.sentimentCount ? values.sentimentTotal / values.sentimentCount : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredSessions]);

  const sentimentBreakdown = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0 };

    filteredSessions.forEach((session) => {
      counts[normalizeSentiment(session.sentiment)] += 1;
    });

    return [
      { name: "Positive", value: counts.positive, key: "positive" },
      { name: "Neutral", value: counts.neutral, key: "neutral" },
      { name: "Negative", value: counts.negative, key: "negative" },
    ];
  }, [filteredSessions]);

  const urgencyTrend = useMemo(() => {
    const grouped = new Map<string, number>();

    filteredSessions.forEach((session) => {
      if (session.urgency !== "high" || !session.created_at) return;
      const day = session.created_at.slice(0, 10);
      grouped.set(day, (grouped.get(day) ?? 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSessions]);

  const hasData = filteredSessions.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Date range</Label>
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <CalendarRange className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="date"
                  className="pl-9"
                  value={dateRange.from}
                  max={dateRange.to}
                  onChange={(event) =>
                    setDateRange((prev) => ({ ...prev, from: event.target.value || prev.from }))
                  }
                />
              </div>
              <div className="relative w-full">
                <CalendarRange className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="date"
                  className="pl-9"
                  value={dateRange.to}
                  min={dateRange.from}
                  onChange={(event) =>
                    setDateRange((prev) => ({ ...prev, to: event.target.value || prev.to }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Topic</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedTopics.length === 0 ? "All topics" : `${selectedTopics.length} selected`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Topics</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {topicOptions.length === 0 ? (
                  <div className="px-2 py-1 text-sm text-muted-foreground">No topics found</div>
                ) : (
                  topicOptions.map((topic) => (
                    <DropdownMenuCheckboxItem
                      key={topic}
                      checked={selectedTopics.includes(topic)}
                      onCheckedChange={(checked) => {
                        setSelectedTopics((prev) =>
                          checked ? [...prev, topic] : prev.filter((value) => value !== topic),
                        );
                      }}
                    >
                      {topic}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label>Channel</Label>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger>
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_CHANNEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((key) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="h-64">
                <Skeleton className="h-full w-full" />
              </CardContent>
            </Card>
          ))}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-52" />
            </CardHeader>
            <CardContent className="h-64">
              <Skeleton className="h-full w-full" />
            </CardContent>
          </Card>
        </div>
      ) : !hasData ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No data in selected range
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Topic distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicChartData} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="topic" interval={0} hide={topicChartData.length > 6} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {topicChartData.map((entry) => {
                        const sentimentClass = entry.avgSentiment > 0 ? "var(--chart-1)" : entry.avgSentiment < 0 ? "var(--destructive)" : "var(--muted-foreground)";
                        return <Cell key={entry.topic} fill={`hsl(${sentimentClass})`} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sentiment breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
                    >
                      {sentimentBreakdown.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={
                            entry.key === "positive"
                              ? "hsl(var(--chart-1))"
                              : entry.key === "negative"
                              ? "hsl(var(--destructive))"
                              : "hsl(var(--chart-2))"
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">High urgency trend</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={urgencyTrend} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-1))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
