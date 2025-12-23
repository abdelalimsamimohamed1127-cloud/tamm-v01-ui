import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Filter, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  primary_topic: string | null;
  sentiment_score: number | null;
  tags: string[] | null;
  urgency: string | null;
  channel_id: string;
  updated_at: string;
  channels?: { name: string; type: string } | null;
};

const sentimentLabel = (score: number | null) => {
  if (score === 1) return "positive";
  if (score === -1) return "negative";
  return "neutral";
};

const sentimentColor: Record<string, string> = {
  positive: "text-emerald-600",
  neutral: "text-slate-600",
  negative: "text-rose-600",
};

export default function InsightsExplorer() {
  const { workspace } = useWorkspace();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [sentimentFilter, setSentimentFilter] = useState<"all" | "positive" | "neutral" | "negative">("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [drawerId, setDrawerId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const run = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("conversations")
        .select("id,primary_topic,sentiment_score,tags,urgency,channel_id,updated_at,channels(name,type)")
        .eq("workspace_id", workspace.id)
        .order("updated_at", { ascending: false })
        .limit(250);

      setConversations((data as Conversation[]) ?? []);
      setLoading(false);
    };
    void run();
  }, [workspace.id]);

  const channelOptions = useMemo(() => {
    const grouped = new Map<string, string>();
    conversations.forEach((c) => {
      const label = c.channels?.name ?? c.channel_id;
      grouped.set(c.channel_id, label);
    });
    return Array.from(grouped.entries()).map(([id, label]) => ({ id, label }));
  }, [conversations]);

  const topicOptions = useMemo(() => {
    const topics = new Set<string>();
    conversations.forEach((c) => {
      if (c.primary_topic) topics.add(c.primary_topic);
    });
    return Array.from(topics);
  }, [conversations]);

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      const sent = sentimentLabel(c.sentiment_score);
      const inChannel = selectedChannels.length ? selectedChannels.includes(c.channel_id) : true;
      const inTopic = selectedTopics.length ? selectedTopics.includes(c.primary_topic ?? "") : true;
      const inSentiment = sentimentFilter === "all" ? true : sent === sentimentFilter;

      const ts = new Date(c.updated_at).getTime();
      const fromOk = dateFrom ? ts >= new Date(dateFrom).getTime() : true;
      const toOk = dateTo ? ts <= new Date(dateTo).getTime() : true;

      return inChannel && inTopic && inSentiment && fromOk && toOk;
    });
  }, [conversations, selectedChannels, selectedTopics, sentimentFilter, dateFrom, dateTo]);

  const topicData = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((c) => {
      const key = c.primary_topic ?? "unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([topic, count]) => ({ topic, count }));
  }, [filtered]);

  const sentimentData = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0 };
    filtered.forEach((c) => {
      counts[sentimentLabel(c.sentiment_score)] += 1;
    });
    return [
      { name: "Positive", value: counts.positive },
      { name: "Neutral", value: counts.neutral },
      { name: "Negative", value: counts.negative },
    ];
  }, [filtered]);

  const trendData = useMemo(() => {
    const grouped = new Map<string, { total: number; count: number }>();
    filtered.forEach((c) => {
      const day = new Date(c.updated_at).toISOString().slice(0, 10);
      const entry = grouped.get(day) ?? { total: 0, count: 0 };
      entry.total += c.sentiment_score ?? 0;
      entry.count += 1;
      grouped.set(day, entry);
    });
    return Array.from(grouped.entries())
      .map(([day, { total, count }]) => ({ day, sentiment: count ? total / count : 0 }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [filtered]);

  const activeConversation = filtered.find((c) => c.id === drawerId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Channels</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedChannels.length === 0 ? "All channels" : `${selectedChannels.length} selected`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Channels</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {channelOptions.map((ch) => (
                  <DropdownMenuCheckboxItem
                    key={ch.id}
                    checked={selectedChannels.includes(ch.id)}
                    onCheckedChange={(v) => {
                      setSelectedChannels((prev) =>
                        v ? [...prev, ch.id] : prev.filter((id) => id !== ch.id)
                      );
                    }}
                  >
                    {ch.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label>Topics</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedTopics.length === 0 ? "All topics" : `${selectedTopics.length} selected`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Topics</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {topicOptions.map((topic) => (
                  <DropdownMenuCheckboxItem
                    key={topic}
                    checked={selectedTopics.includes(topic)}
                    onCheckedChange={(v) => {
                      setSelectedTopics((prev) => (v ? [...prev, topic] : prev.filter((t) => t !== topic)));
                    }}
                  >
                    {topic}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label>Sentiment</Label>
            <ToggleGroup type="single" value={sentimentFilter} onValueChange={(v) => setSentimentFilter((v as any) || "all")}>
              <ToggleGroupItem value="all" aria-label="All">All</ToggleGroupItem>
              <ToggleGroupItem value="positive" aria-label="Positive">Positive</ToggleGroupItem>
              <ToggleGroupItem value="neutral" aria-label="Neutral">Neutral</ToggleGroupItem>
              <ToggleGroupItem value="negative" aria-label="Negative">Negative</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label>Date range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <CalendarDays className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input type="date" className="pl-10" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="relative">
                <CalendarDays className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input type="date" className="pl-10" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Conversations by topic</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="topic" hide={topicData.length > 6 ? false : false} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sentiment distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label
                />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sentiment trend</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis domain={[-1, 1]} tickCount={5} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sentiment" stroke="#10b981" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Flagged activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[420px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      Loading conversations...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      No conversations match filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.slice(0, 50).map((c) => {
                    const sentiment = sentimentLabel(c.sentiment_score);
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => setDrawerId(c.id)}>
                        <TableCell>{c.channels?.name ?? c.channel_id}</TableCell>
                        <TableCell className="capitalize">{c.primary_topic ?? "—"}</TableCell>
                        <TableCell className={cn("capitalize", sentimentColor[sentiment])}>{sentiment}</TableCell>
                        <TableCell>{new Date(c.updated_at).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Sheet open={Boolean(drawerId)} onOpenChange={(open) => !open && setDrawerId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Conversation details</SheetTitle>
          </SheetHeader>
          {activeConversation ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Channel</span>
                <span className="font-medium">{activeConversation.channels?.name ?? activeConversation.channel_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Topic</span>
                <span className="font-medium capitalize">{activeConversation.primary_topic ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sentiment</span>
                <Badge variant="outline" className={cn("capitalize", sentimentColor[sentimentLabel(activeConversation.sentiment_score)])}>
                  {sentimentLabel(activeConversation.sentiment_score)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Urgency</span>
                <Badge variant="secondary" className="capitalize">
                  {activeConversation.urgency ?? "—"}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {(activeConversation.tags ?? []).length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    (activeConversation.tags ?? []).map((tag) => (
                      <Badge key={tag} variant="outline" className="capitalize">
                        {tag}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="text-muted-foreground text-xs">
                Updated at: {new Date(activeConversation.updated_at).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">Select a conversation to view details.</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
