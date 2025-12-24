import { supabase } from "@/integrations/supabase/client";

export type LowConfidenceItem = {
  id: string;
  sessionId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  userQuery?: string | null;
  aiResponse?: string | null;
  confidence?: number | null;
  createdAt?: string | null;
  chunks?: unknown;
  citations?: unknown;
};

export type FeedbackItem = {
  id: string;
  aiMessage?: string | null;
  aiMessageId?: string | null;
  userMessage?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  comment?: string | null;
  createdAt?: string | null;
};

export type SessionMessage = {
  id: string;
  session_id?: string | null;
  role?: string | null;
  content?: string | null;
  created_at?: string | null;
};

function normalizeConfidence(row: any): number | null {
  const confidenceScore = row?.confidence_score ?? row?.confidence;
  const numericValue = typeof confidenceScore === "string" ? Number(confidenceScore) : confidenceScore;
  return Number.isFinite(numericValue) ? Number(numericValue) : null;
}

export async function fetchLowConfidenceItems(): Promise<LowConfidenceItem[]> {
  try {
    const { data, error } = await supabase
      .from("rag_traces")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const items = (data ?? []).map((row: any) => ({
      id: row.id,
      sessionId: row.session_id ?? row.conversation_id ?? null,
      conversationId: row.conversation_id ?? null,
      messageId: row.message_id ?? null,
      userQuery: row.user_query ?? row.query_text ?? row.rewritten_query ?? "",
      aiResponse: row.ai_response ?? row.rewritten_query ?? null,
      confidence: normalizeConfidence(row),
      createdAt: row.created_at ?? null,
      chunks: row.chunks ?? null,
      citations: row.citations ?? null,
    } as LowConfidenceItem));

    const prioritized = items.filter((item) => typeof item.confidence === "number" && item.confidence < 0.6);

    return prioritized.length > 0 ? prioritized : items;
  } catch (error) {
    console.warn("Failed to fetch low confidence traces", error);
    return [];
  }
}

export async function fetchNegativeFeedbackItems(): Promise<FeedbackItem[]> {
  try {
    const { data: feedbackRows, error } = await supabase
      .from("message_feedback")
      .select("*")
      .eq("rating", -1)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    const feedback = feedbackRows ?? [];
    const messageIds = feedback
      .map((row: any) => row.message_id)
      .filter((id: unknown): id is string => typeof id === "string");

    let messages: SessionMessage[] = [];

    if (messageIds.length > 0) {
      const { data: messageRows, error: messageError } = await supabase
        .from("chat_messages")
        .select("id, session_id, role, content, created_at")
        .in("id", messageIds);

      if (!messageError && messageRows) {
        messages = messageRows as SessionMessage[];
      }
    }

    const messageById = new Map(messages.map((message) => [message.id, message]));

    const enriched = await Promise.all(
      feedback.map(async (row: any) => {
        const aiMessage = row.message_id ? messageById.get(row.message_id) ?? null : null;
        let userMessage: SessionMessage | null = null;

        if (aiMessage?.session_id && aiMessage?.created_at) {
          const { data: contextRows, error: contextError } = await supabase
            .from("chat_messages")
            .select("id, session_id, role, content, created_at")
            .eq("session_id", aiMessage.session_id)
            .lte("created_at", aiMessage.created_at)
            .order("created_at", { ascending: false })
            .limit(5);

          if (!contextError && contextRows) {
            userMessage = (contextRows as SessionMessage[]).find(
              (message) => message.role === "user" && message.id !== aiMessage.id,
            ) ?? null;
          }
        }

        return {
          id: row.id,
          aiMessageId: row.message_id ?? null,
          aiMessage: aiMessage?.content ?? null,
          userMessage: userMessage?.content ?? null,
          sessionId: aiMessage?.session_id ?? null,
          conversationId: row.conversation_id ?? null,
          comment: row.comment ?? null,
          createdAt: row.created_at ?? null,
        } satisfies FeedbackItem;
      }),
    );

    return enriched;
  } catch (error) {
    console.warn("Failed to fetch negative feedback", error);
    return [];
  }
}

export async function fetchSessionMessages(sessionId: string): Promise<SessionMessage[]> {
  if (!sessionId) return [];

  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, session_id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;

    return (data ?? []) as SessionMessage[];
  } catch (error) {
    console.warn("Failed to fetch session messages", error);
    return [];
  }
}
