import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

 type Filters = {
  channel: string;
  from: string;
  to: string;
  topic: string;
  sentiment: string;
};

const defaultFilters: Filters = {
  channel: "all",
  from: "",
  to: "",
  topic: "all",
  sentiment: "all",
};

const metrics = [
  { label: "Total messages", value: "24,580", change: "+8%" },
  { label: "Orders detected", value: "1,142", change: "+4%" },
  { label: "Tickets opened", value: "742", change: "+6%" },
];

const channelPerformance = [
  { channel: "WhatsApp", messages: "12,340", response: "94%", time: "1m 12s" },
  { channel: "Instagram", messages: "6,420", response: "92%", time: "1m 35s" },
  { channel: "Messenger", messages: "3,120", response: "89%", time: "1m 58s" },
  { channel: "Web", messages: "2,700", response: "96%", time: "48s" },
];

const aiInsights = [
  { label: "AI resolution", value: "81%", hint: "Conversations handled without human handoff" },
  { label: "Avg. first response", value: "9.3s", hint: "Time to first reply across all channels" },
  { label: "Suggested replies used", value: "64%", hint: "Human agents accepted AI drafts" },
];

const businessInsights = [
  "Order confirmations increased after hours by 12% week-over-week.",
  "Ticket-type requests are down 6% after workflow updates.",
  "Top converting channel remains WhatsApp with 2.4x lift over Instagram.",
];

const topTopics = [
  { topic: "Shipping delays", volume: 420 },
  { topic: "Payment issues", volume: 310 },
  { topic: "Returns", volume: 260 },
  { topic: "New orders", volume: 230 },
];

const sentiments = [
  { label: "Positive", value: 62 },
  { label: "Neutral", value: 24 },
  { label: "Negative", value: 14 },
];

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const next = { ...defaultFilters };
    const channel = searchParams.get("channel");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const topic = searchParams.get("topic");
    const sentiment = searchParams.get("sentiment");
    if (channel) next.channel = channel;
    if (from) next.from = from;
    if (to) next.to = to;
    if (topic) next.topic = topic;
    if (sentiment) next.sentiment = sentiment;
    setFilters(next);
  }, [searchParams]);

  const applyFilters = (payload: Filters) => {
    const params: Record<string, string> = {};
    if (payload.channel !== "all") params.channel = payload.channel;
    if (payload.from) params.from = payload.from;
    if (payload.to) params.to = payload.to;
    if (payload.topic !== "all") params.topic = payload.topic;
    if (payload.sentiment !== "all") params.sentiment = payload.sentiment;
    setSearchParams(params);
    setSheetOpen(false);
  };

  const resetFilters = () => {
    setSearchParams({});
  };

  const filterBar = (isInline = true) => (
    <div className={`grid gap-3 ${isInline ? "md:grid-cols-5" : "grid-cols-1"}`}>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Channel</p>
        <Select value={filters.channel} onValueChange={(v) => setFilters((f) => ({ ...f, channel: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="messenger">Messenger</SelectItem>
            <SelectItem value="web">Web</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">From</p>
        <Input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">To</p>
        <Input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Topic</p>
        <Select value={filters.topic} onValueChange={(v) => setFilters((f) => ({ ...f, topic: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Topic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All topics</SelectItem>
            <SelectItem value="shipping">Shipping</SelectItem>
            <SelectItem value="payment">Payment</SelectItem>
            <SelectItem value="returns">Returns</SelectItem>
            <SelectItem value="orders">Orders</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Sentiment</p>
        <Select value={filters.sentiment} onValueChange={(v) => setFilters((f) => ({ ...f, sentiment: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Sentiment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="positive">Positive</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="negative">Negative</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const sentimentTotal = useMemo(() => sentiments.reduce((sum, s) => sum + s.value, 0), []);

  return (
    <div className="space-y-6">
      <div className="space-y-1 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Performance snapshots across channels and AI responses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetFilters}>Reset</Button>
          <Button onClick={() => applyFilters(filters)}>Apply</Button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="md:hidden">Filters</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Advanced filters</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {filterBar(false)}
              </div>
              <SheetFooter className="mt-6 flex gap-2 justify-end">
                <Button variant="outline" onClick={resetFilters}>Reset</Button>
                <Button onClick={() => applyFilters(filters)}>Apply</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Card className="p-4 space-y-3 hidden md:block">
        {filterBar()}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={resetFilters}>Reset</Button>
          <Button size="sm" onClick={() => applyFilters(filters)}>Apply</Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-2xl">{metric.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className={metric.change.startsWith("-") ? "text-destructive" : "text-emerald-600"}>
                {metric.change}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Channel performance</CardTitle>
            <CardDescription>Volume and responsiveness by channel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {channelPerformance.map((row) => (
              <div key={row.channel} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{row.channel}</div>
                  <Badge variant="secondary">{row.messages} msgs</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>Response rate: {row.response}</div>
                  <div>Avg. response: {row.time}</div>
                </div>
                <Progress value={parseInt(row.response)} className="mt-3" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>AI response insights</CardTitle>
            <CardDescription>Quality and adoption of automated replies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiInsights.map((insight) => (
              <div key={insight.label} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{insight.label}</div>
                  <span className="text-lg font-semibold">{insight.value}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{insight.hint}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top topics</CardTitle>
          <CardDescription>Most frequent intents in the selected period.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {topTopics.map((topic) => (
            <div key={topic.topic} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium">{topic.topic}</span>
              <Badge variant="secondary">{topic.volume}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sentiment distribution</CardTitle>
          <CardDescription>Snapshot of customer sentiment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sentiments.map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{s.label}</span>
                <span>{s.value}%</span>
              </div>
              <Progress value={(s.value / sentimentTotal) * 100} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Monthly report</CardTitle>
            <CardDescription>Summary across channels, orders, and AI efficiency.</CardDescription>
          </div>
          <Button variant="outline">Generate report</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Top channel</p>
              <p className="text-lg font-semibold">WhatsApp</p>
              <p className="text-xs text-muted-foreground">53% of total conversations</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Conversion rate</p>
              <p className="text-lg font-semibold">18.4%</p>
              <p className="text-xs text-muted-foreground">Orders from qualified inquiries</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Avg. resolution</p>
              <p className="text-lg font-semibold">3.8 interactions</p>
              <p className="text-xs text-muted-foreground">Messages per resolved thread</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
