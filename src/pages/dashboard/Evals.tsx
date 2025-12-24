import { useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchLowConfidenceItems,
  fetchNegativeFeedbackItems,
  fetchSessionMessages,
  type FeedbackItem,
  type LowConfidenceItem,
  type SessionMessage,
} from "@/services/evals";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";

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

function parseContextChunks(raw: unknown) {
  if (!raw) return [] as any[];
  const input = typeof raw === "string" ? (() => {
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  })() : raw;

  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && "chunks" in (input as Record<string, unknown>)) {
    const chunks = (input as { chunks?: unknown }).chunks;
    return Array.isArray(chunks) ? chunks : [];
  }
  return [] as any[];
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

function ContextChunks({ rawChunks }: { rawChunks: unknown }) {
  const chunks = parseContextChunks(rawChunks);

  if (!chunks.length) {
    return <p className="text-sm text-muted-foreground">No retrieved context available.</p>;
  }

  return (
    <Accordion type="multiple" className="w-full space-y-2">
      {chunks.map((chunk, index) => {
        const value = typeof chunk === "object" && chunk !== null ? (chunk as Record<string, any>) : {};
        const title = value.title || value.source || `Chunk ${index + 1}`;
        const content = value.content || value.text || JSON.stringify(chunk, null, 2);

        return (
          <AccordionItem key={index} value={`chunk-${index}`}>
            <AccordionTrigger className="text-left text-sm font-medium">{title}</AccordionTrigger>
            <AccordionContent>
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                {value.source && (
                  <div className="mb-2 text-xs text-muted-foreground">Source: {value.source}</div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function LowConfidenceTable({
  data,
  isLoading,
  onInspect,
}: {
  data: LowConfidenceItem[];
  isLoading: boolean;
  onInspect: (item: LowConfidenceItem) => void;
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
            <TableHead>Query</TableHead>
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
                  {item.userQuery || "(no query)"}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge className={cn("px-2", scoreBadgeClass(item.confidence))}>{formatScore(item.confidence)}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{relativeTime(item.createdAt)}</TableCell>
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

function NegativeFeedbackList({ data, isLoading }: { data: FeedbackItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="space-y-2 rounded-md border p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!data.length) {
    return <p className="text-sm text-muted-foreground">No negative feedback yet.</p>;
  }

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.id} className="space-y-3 rounded-md border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <span>{relativeTime(item.createdAt)}</span>
            {item.comment && <span className="truncate">· {item.comment}</span>}
          </div>
          {item.userMessage && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">User</div>
              <div className="rounded-md border bg-muted/40 p-3 text-sm leading-relaxed">
                {item.userMessage}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">AI Reply</div>
            <div className="rounded-md border bg-muted p-3 text-sm leading-relaxed">
              {item.aiMessage ?? "Message unavailable"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EvalsContent() {
  const { toast } = useToast();
  const [selectedTrace, setSelectedTrace] = useState<LowConfidenceItem | null>(null);

  const { data: lowConfidenceData = [], isLoading: isLoadingLowConfidence } = useQuery({
    queryKey: ["evals", "low-confidence"],
    queryFn: fetchLowConfidenceItems,
  });

  const { data: negativeFeedback = [], isLoading: isLoadingFeedback } = useQuery({
    queryKey: ["evals", "negative-feedback"],
    queryFn: fetchNegativeFeedbackItems,
  });

  const sessionIdForInspector = useMemo(
    () => selectedTrace?.sessionId || selectedTrace?.conversationId || null,
    [selectedTrace],
  );

  const {
    data: sessionMessages = [],
    isLoading: isLoadingMessages,
  } = useQuery({
    queryKey: ["evals", "session-messages", sessionIdForInspector],
    queryFn: () => (sessionIdForInspector ? fetchSessionMessages(sessionIdForInspector) : Promise.resolve([])),
    enabled: Boolean(sessionIdForInspector && selectedTrace),
  });

  const handleAddToKnowledgeBase = () => {
    toast({ title: "Coming soon", description: "Add to Knowledge Base will be available soon." });
  };

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Evals Inspector</h1>
        <p className="text-sm text-muted-foreground">
          Monitor low-confidence retrievals and investigate negative feedback.
        </p>
      </div>

      <Tabs defaultValue="low" className="space-y-4">
        <TabsList>
          <TabsTrigger value="low">Low Confidence</TabsTrigger>
          <TabsTrigger value="feedback">Negative Feedback</TabsTrigger>
        </TabsList>
        <TabsContent value="low" className="space-y-4">
          <LowConfidenceTable
            data={lowConfidenceData}
            isLoading={isLoadingLowConfidence}
            onInspect={setSelectedTrace}
          />
        </TabsContent>
        <TabsContent value="feedback" className="space-y-4">
          <NegativeFeedbackList data={negativeFeedback} isLoading={isLoadingFeedback} />
        </TabsContent>
      </Tabs>

      <Sheet open={Boolean(selectedTrace)} onOpenChange={(open) => !open && setSelectedTrace(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Trace Inspector</SheetTitle>
            <SheetDescription>
              {selectedTrace?.userQuery || "Review trace details and context."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Conversation</h3>
                <Badge variant="outline" className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {formatScore(selectedTrace?.confidence ?? null)}
                </Badge>
              </div>
              <ScrollArea className="h-80 rounded-md border p-3">
                <ConversationMessages messages={sessionMessages} isLoading={isLoadingMessages} />
              </ScrollArea>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Retrieved Context</h3>
              <ContextChunks rawChunks={selectedTrace?.chunks ?? selectedTrace?.citations} />
            </div>

            <Separator />

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Actions</h3>
              <Button onClick={handleAddToKnowledgeBase}>Add to Knowledge Base</Button>
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
