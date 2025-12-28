import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ThumbsDown, ThumbsUp } from "lucide-react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLowConfidenceTraces,
  getSessionMessages,
  submitFeedback,
  checkFeedbackExists,
  type LowConfidenceTrace,
  type SessionMessage,
} from "@/services/evals";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks";

function scoreBadgeClass(score: number | null | undefined) {
  if (typeof score !== "number") return "";
  if (score < 0.4) return "bg-destructive text-destructive-foreground";
  if (score < 0.7) return "bg-amber-500 text-black";
  return "";
}

function formatScore(score: number | null | undefined) {
  if (typeof score !== "number") return "N/A";
  return `${Math.round(score * 100)}%`;
}

function relativeTime(timestamp?: string | null) {
  if (!timestamp) return "";
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

function ConversationMessages({
  messages,
  isLoading,
}: {
  messages: SessionMessage[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="space-y-2 rounded-md border p-3">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!messages.length) {
    return <p className="text-sm text-muted-foreground">No messages found for this session.</p>;
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "space-y-1 rounded-md border p-3",
            message.role === "assistant" && "bg-muted",
          )}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium capitalize">{message.role ?? "unknown"}</span>
            <span>{relativeTime(message.created_at)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content ?? ""}</p>
        </div>
      ))}
    </div>
  );
}

function LowConfidenceTable({
  data,
  isLoading,
  onInspect,
}: {
  data: LowConfidenceTrace[];
  isLoading: boolean;
  onInspect: (item: LowConfidenceTrace) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-md border p-3">
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!data.length) {
    return <p className="text-sm text-muted-foreground">No low confidence traces available.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reason</TableHead>
            <TableHead className="w-[120px] text-center">Score</TableHead>
            <TableHead className="w-[160px]">Date</TableHead>
            <TableHead className="w-[120px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="line-clamp-2 text-sm leading-relaxed text-foreground">
                  {item.reason || "(no reason provided)"}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge className={cn("px-2", scoreBadgeClass(item.confidence_score))}>{formatScore(item.confidence_score)}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{relativeTime(item.created_at)}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => onInspect(item)}>
                  Inspect
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EvalsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const { workspace } = useWorkspace();

  const [selectedTrace, setSelectedTrace] = useState<LowConfidenceTrace | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<"good" | "bad" | null>(null);
  const [feedbackComment, setFeedbackComment] = useState<string>("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);

  const { data: lowConfidenceData = [], isLoading: isLoadingLowConfidence } = useQuery({
    queryKey: ["evals", "low-confidence", workspace?.id],
    queryFn: () => getLowConfidenceTraces(workspace!.id),
    enabled: Boolean(workspace?.id && auth?.token),
  });

  const sessionIdForInspector = useMemo(
    () => selectedTrace?.session_id || null,
    [selectedTrace],
  );

  const {
    data: sessionMessages = [],
    isLoading: isLoadingMessages,
  } = useQuery({
    queryKey: ["evals", "session-messages", workspace?.id, sessionIdForInspector],
    queryFn: () => getSessionMessages(workspace!.id, sessionIdForInspector!),
    enabled: Boolean(sessionIdForInspector && workspace?.id && auth?.token),
  });

  const { data: feedbackAlreadySubmitted = false, isLoading: isLoadingFeedbackStatus } = useQuery({
    queryKey: ["evals", "feedback-status", selectedTrace?.id],
    queryFn: () => checkFeedbackExists(workspace!.id, selectedTrace!.id),
    enabled: Boolean(selectedTrace?.id && workspace?.id && auth?.token),
  });

  const handleSubmitFeedback = useCallback(async () => {
    if (!selectedTrace || !workspace?.id || !auth?.token || !feedbackRating) {
      toast({
        title: "Missing Information",
        description: "Please select a rating.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      await submitFeedback({
        workspace_id: workspace.id,
        trace_id: selectedTrace.id,
        rating: feedbackRating,
        comment: feedbackComment.trim() || null,
      });

      toast({
        title: "Feedback Submitted",
        description: "Your feedback has been recorded.",
      });
      setFeedbackRating(null);
      setFeedbackComment("");
      // Invalidate query to refetch feedback status for this trace
      await queryClient.invalidateQueries({ queryKey: ["evals", "feedback-status", selectedTrace.id] });
    } catch (error: any) {
      toast({
        title: "Error Submitting Feedback",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
      console.error("Error submitting feedback:", error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  }, [selectedTrace, workspace?.id, auth?.token, feedbackRating, feedbackComment, queryClient, toast]);

  // Reset feedback form when selectedTrace changes
  useEffect(() => {
    setFeedbackRating(null);
    setFeedbackComment("");
  }, [selectedTrace]);

  const handleInspectTrace = useCallback((trace: LowConfidenceTrace) => {
    setSelectedTrace(trace);
  }, []);

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Evals Inspector</h1>
        <p className="text-sm text-muted-foreground">
          Monitor low-confidence retrievals and investigate feedback.
        </p>
      </div>

      <Tabs defaultValue="low" className="space-y-4">
        <TabsList>
          <TabsTrigger value="low">Low Confidence Traces</TabsTrigger>
        </TabsList>
        <TabsContent value="low" className="space-y-4">
          <LowConfidenceTable
            data={lowConfidenceData}
            isLoading={isLoadingLowConfidence}
            onInspect={handleInspectTrace}
          />
        </TabsContent>
      </Tabs>

      <Sheet open={Boolean(selectedTrace)} onOpenChange={(open) => !open && setSelectedTrace(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Trace Inspector</SheetTitle>
            <SheetDescription>
              {selectedTrace?.reason || "Review trace details."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Conversation</h3>
                <Badge variant="outline" className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {formatScore(selectedTrace?.confidence_score ?? null)}
                </Badge>
              </div>
              <ScrollArea className="h-80 rounded-md border p-3">
                <ConversationMessages messages={sessionMessages} isLoading={isLoadingMessages} />
              </ScrollArea>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Feedback</h3>
              {isLoadingFeedbackStatus ? (
                <Skeleton className="h-20 w-full" />
              ) : feedbackAlreadySubmitted ? (
                <p className="text-sm text-muted-foreground">
                  Feedback already submitted for this trace.
                </p>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); void handleSubmitFeedback(); }} className="space-y-4">
                  <RadioGroup value={feedbackRating || ""} onValueChange={(value: "good" | "bad") => setFeedbackRating(value)} className="flex space-x-4">
                    <div>
                      <RadioGroupItem value="good" id="rating-good" className="peer sr-only" />
                      <Label htmlFor="rating-good" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        <ThumbsUp className="mb-3 h-6 w-6" />
                        <span>Good</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="bad" id="rating-bad" className="peer sr-only" />
                      <Label htmlFor="rating-bad" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        <ThumbsDown className="mb-3 h-6 w-6" />
                        <span>Bad</span>
                      </Label>
                    </div>
                  </RadioGroup>
                  <Textarea
                    placeholder="Optional: Add a comment about this trace..."
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    rows={3}
                  />
                  <Button type="submit" disabled={isSubmittingFeedback || !feedbackRating}>
                    {isSubmittingFeedback ? "Submitting..." : "Submit Feedback"}
                  </Button>
                </form>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Actions</h3>
              <Button disabled onClick={() => toast({ title: "Coming soon", description: "Add to Knowledge Base will be available soon." })}>Add to Knowledge Base</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function Evals() {
  const queryClientRef = useRef<QueryClient>();
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient();
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <EvalsContent />
    </QueryClientProvider>
  );
}


