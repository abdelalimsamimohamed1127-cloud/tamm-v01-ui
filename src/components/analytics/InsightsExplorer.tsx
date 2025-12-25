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
import { addDays, startOfDay } from 'date-fns';

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightsFilters, type FiltersState } from "./InsightsFilters";

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

type InsightsExplorerProps = {
  onSessionsChange?: (sessions: ChatSessionSummary[]) => void;
};

const SENTIMENT_SCORE: Record<string, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
};

function buildDefaultDateRange() {
  const to = startOfDay(new Date());
  const from = addDays(to, -6);
  return { from, to };
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
  return channel.toLowerCase();
}

export default function InsightsExplorer({ onSessionsChange }: InsightsExplorerProps) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [topicOptions, setTopicOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filters, setFilters] = useState<FiltersState>({
    dateRange: buildDefaultDateRange(),
    topics: [],
    sentiments: [],
    channel: 'all',
  });

  useEffect(() => {
    async function fetchSessions() {
      if (!filters.dateRange?.from) return;

      setIsLoading(true);
      try {
        const from = filters.dateRange.from;
        const to = filters.dateRange.to ? filters.dateRange.to : from;
        
        const toEndOfDay = new Date(to);
        toEndOfDay.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
          .from("chat_sessions")
          .select(
            "id, topic, sentiment, urgency, channel, channel_id, created_at, external_user_id, user_id, session_id",
          )
          .gte("created_at", from.toISOString())
          .lte("created_at", toEndOfDay.toISOString())
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
        const sortedTopics = Array.from(uniqueTopics.values()).sort();
        setTopicOptions(sortedTopics);

      } catch (error) {
        console.error("Failed to load insights sessions", error);
        setSessions([]);
        setTopicOptions([]);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchSessions();
  }, [filters.dateRange]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const topic = normalizeTopic(session.topic);
      const channel = normalizeChannel(session.channel);
      const sentiment = normalizeSentiment(session.sentiment);

      const topicMatch = filters.topics.length === 0 || filters.topics.includes(topic);
      const channelMatch = filters.channel === "all" || channel === filters.channel;
      const sentimentMatch = filters.sentiments.length === 0 || filters.sentiments.includes(sentiment);

      return topicMatch && channelMatch && sentimentMatch;
    });
  }, [sessions, filters]);

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
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.topics.length > 0) count++;
    if (filters.sentiments.length > 0) count++;
    if (filters.channel !== 'all') count++;
    return count;
  }, [filters]);

  const hasData = filteredSessions.length > 0;

  return (
    <div className="space-y-4">
      <InsightsFilters 
        filters={filters}
        onFiltersChange={setFilters}
        topicOptions={topicOptions}
        activeFilterCount={activeFilterCount}
      />
      
      <div className="flex-1 min-w-0">
        {isLoading ? (
          <div className="space-y-4">
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
            </div>
            <Card>
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
            <CardContent className="py-20 text-center text-muted-foreground">
              No data matching your filter criteria.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
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
          </div>
        )}
      </div>
    </div>
  );
}
