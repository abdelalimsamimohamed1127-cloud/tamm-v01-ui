import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import InsightsExplorer, { type ChatSessionSummary } from "@/components/analytics/InsightsExplorer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

function normalizeTopic(topic: string | null | undefined) {
  return topic?.trim() ? topic.trim() : "Unclassified";
}

function normalizeSentiment(sentiment: string | null | undefined) {
  if (sentiment === "positive" || sentiment === "negative" || sentiment === "neutral") {
    return sentiment;
  }
  return "neutral";
}

export default function Insights() {
  const [visibleSessions, setVisibleSessions] = useState<ChatSessionSummary[]>([]);
  const navigate = useNavigate();

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

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Insights Explorer</h1>
        <p className="text-muted-foreground">Visualize conversation topics, sentiment, and urgency trends.</p>
      </div>

      <InsightsExplorer onSessionsChange={setVisibleSessions} />

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
