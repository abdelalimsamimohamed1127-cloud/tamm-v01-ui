function normalizeTopic(topic: string | null | undefined) {
  return topic?.trim() ? topic.trim() : "Unclassified";
}

function normalizeSentiment(sentiment: string | null | undefined) {
  if (sentiment === "positive" || sentiment === "negative" || sentiment === "neutral") {
    return sentiment;
  }
  return "neutral";
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import InsightsExplorer, { type ChatSessionSummary } from "@/components/analytics/InsightsExplorer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";


interface Insight {
  id: string;
  workspace_id: string;
  period_start: string; // Date string
  period_end: string;   // Date string
  insight_type: string;
  title: string;
  summary: string;
  payload: Record<string, any>; // jsonb in backend
  created_at: string; // timestampz string
}

export default function Insights() {
  const [visibleSessions, setVisibleSessions] = useState<ChatSessionSummary[]>([]);
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const { auth, loading: authLoading } = useAuth();

  const [insights, setInsights] = useState<Insight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [errorInsights, setErrorInsights] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)), // Default last 7 days
    to: new Date(),
  });
  const [insightTypeFilter, setInsightTypeFilter] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    if (!workspace?.id || !auth?.token) return;

    setLoadingInsights(true);
    setErrorInsights(null);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.append('start_date', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange.to) params.append('end_date', format(dateRange.to, 'yyyy-MM-dd'));
      if (insightTypeFilter) params.append('insight_type', insightTypeFilter);

      const response = await fetch(`/api/v1/analytics/insights?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Error fetching insights: ${response.statusText}`);
      }
      const data: Insight[] = await response.json();
      setInsights(data);
    } catch (error: any) {
      setErrorInsights(error.message);
      toast({
        title: "Error fetching insights",
        description: error.message,
        variant: "destructive",
      });
      console.error("Error fetching insights:", error);
    } finally {
      setLoadingInsights(false);
    }
  }, [workspace?.id, auth?.token, dateRange, insightTypeFilter]);

  useEffect(() => {
    if (!authLoading) {
      fetchInsights();
    }
  }, [fetchInsights, authLoading]);

  const sortedSessions = useMemo(
    () => [...visibleSessions].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
    [visibleSessions],
  );

  const handleRowClick = useCallback(
    (session: ChatSessionSummary) => {
      const sessionId = session.session_id ?? session.id;
      if (!sessionId) return;
      navigate("/dashboard/inbox", { state: { sessionId } });
    },
    [navigate],
  );

  const availableInsightTypes = useMemo(() => {
    const types = new Set(insights.map(i => i.insight_type));
    return Array.from(types).sort();
  }, [insights]);


  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Insights Explorer</h1>
        <p className="text-muted-foreground">Visualize conversation topics, sentiment, and urgency trends.</p>
      </div>

      <InsightsExplorer onSessionsChange={setVisibleSessions} onInsightGenerationComplete={fetchInsights} />
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Generated Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[300px] justify-start text-left font-normal",
                    !dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <Select onValueChange={(value) => setInsightTypeFilter(value === "all" ? null : value)} value={insightTypeFilter || "all"}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Insight Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Insight Types</SelectItem>
                <Separator />
                {availableInsightTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => fetchInsights()} disabled={loadingInsights}>
              {loadingInsights ? "Loading..." : "Refresh Insights"}
            </Button>
          </div>

          {loadingInsights && <p>Loading insights...</p>}
          {errorInsights && <p className="text-red-500">Error: {errorInsights}</p>}

          {!loadingInsights && !errorInsights && insights.length === 0 ? (
            <p className="text-center text-muted-foreground">No generated insights found for the selected period/filters.</p>
          ) : (
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {insights.map((insight) => (
                  <Card key={insight.id} className="shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base flex justify-between items-center">
                        {insight.title}
                        <Badge variant="secondary" className="capitalize">
                          {insight.insight_type.replace(/_/g, ' ')}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(insight.period_start), 'PPP')} - {format(parseISO(insight.period_end), 'PPP')}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{insight.summary}</p>
                      {/* You can add more detailed payload display here if needed */}
                      {insight.payload && Object.keys(insight.payload).length > 0 && (
                        <details className="mt-2 text-xs text-muted-foreground">
                          <summary>Details</summary>
                          <pre className="mt-1 p-2 bg-muted rounded-md overflow-x-auto">
                            {JSON.stringify(insight.payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Drill Down</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead>Customer ID</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    No data in selected range
                  </TableCell>
                </TableRow>
              ) : (
                sortedSessions.map((session) => {
                  const topic = normalizeTopic(session.topic);
                  const sentiment = normalizeSentiment(session.sentiment);
                  const customerId =
                    session.external_user_id || session.user_id || session.session_id || session.id || "Unknown";

                  return (
                    <TableRow
                      key={session.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(session)}
                    >
                      <TableCell className="capitalize">{topic}</TableCell>
                      <TableCell>
                        <Badge
                          variant={sentiment === "negative" ? "destructive" : sentiment === "positive" ? "default" : "secondary"}
                          className={cn("capitalize", sentiment === "neutral" && "text-muted-foreground")}
                        >
                          {sentiment}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{customerId}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {session.created_at ? new Date(session.created_at).toLocaleString() : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
