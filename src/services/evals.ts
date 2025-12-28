import { supabase } from "@/integrations/supabase/client";

export type LowConfidenceTrace = {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  session_id: string;
  confidence_score: number | null;
  reason: string | null;
  created_at: string;
};

export type SessionMessage = {
  id: string;
  session_id?: string | null;
  role?: string | null;
  content?: string | null;
  created_at?: string | null;
};

export type FeedbackPayload = {
  workspace_id: string;
  trace_id: string;
  rating: 'good' | 'bad';
  comment?: string | null;
};

export async function submitFeedback(payload: FeedbackPayload) {
  try {
    const { data, error } = await supabase
      .from("message_feedback")
      .insert({
        workspace_id: payload.workspace_id,
        trace_id: payload.trace_id,
        rating: payload.rating,
        comment: payload.comment || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Failed to submit feedback", error);
    throw error;
  }
}

export async function getLowConfidenceTraces(workspace_id: string): Promise<LowConfidenceTrace[]> {
  try {
    const { data, error } = await supabase
      .from("low_confidence_traces")
      .select("id, workspace_id, agent_id, session_id, confidence_score, reason, created_at")
      .eq("workspace_id", workspace_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const traces = (data ?? []).map((row: any) => ({
      id: row.id,
      workspace_id: row.workspace_id,
      agent_id: row.agent_id,
      session_id: row.session_id,
      confidence_score: row.confidence_score,
      reason: row.reason,
      created_at: row.created_at,
    } as LowConfidenceTrace));

    return traces;
  } catch (error) {
    console.warn("Failed to fetch low confidence traces", error);
    return [];
  }
}

export async function getSessionMessages(workspace_id: string, sessionId: string): Promise<SessionMessage[]> {
  if (!sessionId) return [];

  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, session_id, role, content, created_at")
      .eq("workspace_id", workspace_id) // Add workspace_id filter
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

export async function checkFeedbackExists(workspace_id: string, trace_id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("message_feedback")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("trace_id", trace_id)
      .limit(1);

    if (error) throw error;

    return (data?.length ?? 0) > 0;
  } catch (error) {
    console.error("Failed to check for existing feedback", error);
    throw error;
  }
}
