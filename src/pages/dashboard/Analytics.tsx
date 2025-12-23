import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const metrics = [
  { label: "Messages", value: "24,580", change: "+8%" },
  { label: "Orders", value: "1,142", change: "+4%" },
  { label: "Requests / Inquiries", value: "3,287", change: "-2%" },
];

const channelPerformance = [
  { channel: "WhatsApp", messages: "12,340", response: "94%", time: "1m 12s" },
  { channel: "Instagram", messages: "6,420", response: "92%", time: "1m 35s" },
  { channel: "Facebook", messages: "3,120", response: "89%", time: "1m 58s" },
  { channel: "Web Chat", messages: "2,700", response: "96%", time: "48s" },
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

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">General Analytics</h1>
        <p className="text-sm text-muted-foreground">Operational overview of your AI agents.</p>
      </div>

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
          <CardTitle>Business insights</CardTitle>
          <CardDescription>Callouts surfaced from recent activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {businessInsights.map((item, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="h-2 w-2 rounded-full bg-primary mt-2" />
              <p className="text-sm text-muted-foreground">{item}</p>
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
