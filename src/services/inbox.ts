import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import type { PostgrestResponse } from '@supabase/supabase-js';

// Define Conversation and Message types based on Supabase schema
export type ConversationStatus = 'open' | 'resolved' | 'handoff';
export type MessageSender = 'user' | 'assistant' | 'system';

export type Conversation = {
  id: string;
  workspace_id: string;
  agent_id: string;
  channel: string;
  status: ConversationStatus;
  unread_count: number;
  last_message_at: string;
  last_message_preview: string; // Ensure this field exists for search
  external_user_id: string; // Corresponds to customer_name
  summary: string | null;
  created_at: string;
  updated_at: string;
  // Optional for frontend convenience
  messages?: ConversationMessage[];
  // Optional enrichment fields
  conversation_enrichment?: {
    topic: string | null;
    sentiment: string | null;
    urgency: string | null;
  } | null;
};

export type ConversationMessage = {
  id: string;
  session_id: string; // Corresponds to conversation_id in frontend
  role: MessageSender;
  content: string;
  created_at: string;
};

interface GetConversationsParams {
  workspaceId: string;
  status: ConversationStatus | ConversationStatus[];
  agentId?: string;
  channel?: string;
  search?: string;
  limit?: number;
  cursor?: {
    last_message_at: string;
    id: string;
  };
}

interface GetConversationsResult {
  items: Conversation[];
  nextCursor?: {
    last_message_at: string;
    id: string;
  };
}

export async function getConversations({
  workspaceId,
  status,
  agentId,
  channel,
  search,
  limit = 20,
  cursor,
}: GetConversationsParams): Promise<GetConversationsResult> {
  if (!supabase || !isSupabaseConfigured) {
    console.error("Supabase is not configured.");
    throw new Error("Supabase is not configured.");
  }

  const effectiveLimit = Math.min(limit, 50); // Enforce max limit

  let query = supabase
    .from("conversations")
    .select(
      `
      id,
      workspace_id,
      agent_id,
      channel,
      status,
      unread_count,
      last_message_at,
      last_message_preview,
      external_user_id,
      summary,
      created_at,
      updated_at,
      conversation_enrichment (
        topic,
        sentiment,
        urgency
      )
    `
    )
    .eq("workspace_id", workspaceId);

  // Filter by status
  if (Array.isArray(status)) {
    query = query.in("status", status);
  } else {
    query = query.eq("status", status);
  }

  // Optional filters
  if (agentId) {
    query = query.eq("agent_id", agentId);
  }
  if (channel) {
    query = query.eq("channel", channel);
  }
  if (search) {
    query = query.ilike("last_message_preview", `%${search}%`);
  }

  // Order for pagination
  query = query
    .order("last_message_at", { ascending: false })
    .order("id", { ascending: false }); // Tie-breaker for stable pagination

  // Apply cursor for pagination
  if (cursor) {
    // For DESC ordering, we want items "older" than the cursor
    // So, last_message_at less than cursor's last_message_at
    // OR last_message_at equals cursor's and id less than cursor's (tie-breaker)
    query = query.lt("last_message_at", cursor.last_message_at);
    // The tie-breaker needs to be handled carefully with `or` logic, which Supabase client doesn't directly expose
    // for .order() + .range() or .limit() with complex conditions easily.
    // A common pattern is to fetch `limit + 1` and then use the last item as the next cursor,
    // or use RLS policies or an RPC for more complex cursors involving multiple columns.
    // For simplicity with built-in client, we will filter by last_message_at and then manually filter by id in client
    // if last_message_at is the same for the first `limit` results.
    // Given the constraints, we will simplify: if last_message_at matches, we will rely on id DESC.
    // If the next page has items with same last_message_at as cursor, it will fetch them as well.
    // This is a common simplification without composite index pagination RPCs.
  }

  // Fetch one extra item to determine if there's a next page
  const { data, error }: PostgrestResponse<Conversation> = await query.limit(effectiveLimit).then(response => {
    // Manually handle the composite cursor logic in a less efficient way or accept slight duplicates
    // for entries with identical last_message_at on the boundary if not using a specific composite index.
    // Given the prompt and typical Supabase limitations, we fetch `limit` items
    // and rely on the last_message_at and id ordering.
    // We fetch one more item than the limit to determine if there are more pages.
    if (cursor) {
        return query.lt("last_message_at", cursor.last_message_at).range(0, effectiveLimit).execute();
    }
    return query.range(0, effectiveLimit).execute();
  });


  if (error) {
    console.error("Error getting conversations:", error);
    throw new Error(error.message);
  }

  const items = (data ?? []) as Conversation[];
  let nextCursor: GetConversationsResult["nextCursor"] | undefined;

  if (items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = {
      last_message_at: lastItem.last_message_at,
      id: lastItem.id,
    };
  }

  // The actual implementation of cursor pagination using `lt` on `last_message_at` alone
  // might skip items if multiple conversations share the exact `last_message_at`.
  // A robust solution for composite key pagination (last_message_at, id) involves:
  // 1. Using a stored procedure (RPC) for the `WHERE (last_message_at < X OR (last_message_at = X AND id < Y))` clause.
  // 2. Or fetching `limit + 1` items and manually handling the cursor.
  // For now, based on Supabase client's direct query builder, we rely primarily on `last_message_at` and `id` ordering
  // and construct the cursor based on the last item. The `lt` condition for cursor will be simplified.
  // The current query already orders by `last_message_at DESC, id DESC`.
  // To handle the cursor properly, if a cursor is provided, we need to filter where
  // (last_message_at < cursor.last_message_at) OR (last_message_at = cursor.last_message_at AND id < cursor.id)
  // This is not directly supported by the current Supabase client's `filter` methods in a single call.
  // So, we will implement the common strategy: fetch N+1 items, and if N+1 items are returned,
  // the Nth item is the last for the current page and the (N+1)th item is the cursor for the next page.
  // We need to re-think the query above to fetch effectiveLimit + 1

  let finalQuery = supabase
    .from("conversations")
    .select(
      `
      id,
      workspace_id,
      agent_id,
      channel,
      status,
      unread_count,
      last_message_at,
      last_message_preview,
      external_user_id,
      summary,
      created_at,
      updated_at,
      conversation_enrichment (
        topic,
        sentiment,
        urgency
      )
    `
    )
    .eq("workspace_id", workspaceId);

  if (Array.isArray(status)) {
    finalQuery = finalQuery.in("status", status);
  } else {
    finalQuery = finalQuery.eq("status", status);
  }

  if (agentId) {
    finalQuery = finalQuery.eq("agent_id", agentId);
  }
  if (channel) {
    finalQuery = finalQuery.eq("channel", channel);
  }
  if (search) {
    finalQuery = finalQuery.ilike("last_message_preview", `%${search}%`);
  }

  if (cursor) {
    // For DESC ordering of last_message_at, we want items with an earlier last_message_at
    // For items with the same last_message_at, we want items with an earlier id (due to id DESC)
    finalQuery = finalQuery.or(
      `last_message_at.lt.${cursor.last_message_at},and(last_message_at.eq.${cursor.last_message_at},id.lt.${cursor.id})`
    );
  }

  finalQuery = finalQuery
    .order("last_message_at", { ascending: false })
    .order("id", { ascending: false });

  const { data: finalData, error: finalError }: PostgrestResponse<Conversation> = await finalQuery
    .limit(effectiveLimit + 1) // Fetch one extra to determine next cursor
    .execute();

  if (finalError) {
    console.error("Error getting conversations:", finalError);
    throw new Error(finalError.message);
  }

  const finalItems = (finalData ?? []) as Conversation[];
  const hasMore = finalItems.length > effectiveLimit;
  const conversationsToReturn = finalItems.slice(0, effectiveLimit);

  let finalNextCursor: GetConversationsResult["nextCursor"] | undefined;
  if (hasMore) {
    const lastConv = conversationsToReturn[conversationsToReturn.length - 1];
    finalNextCursor = {
      last_message_at: lastConv.last_message_at,
      id: lastConv.id,
    };
  }

  return {
    items: conversationsToReturn,
    nextCursor: finalNextCursor,
  };
}


interface GetConversationMessagesParams {
  conversationId: string;
  limit?: number;
  cursor?: {
    created_at: string;
    id: string;
  };
}

interface GetConversationMessagesResult {
  items: ConversationMessage[];
  nextCursor?: {
    created_at: string;
    id: string;
  };
}

export async function getConversationMessages({
  conversationId,
  limit = 50,
  cursor,
}: GetConversationMessagesParams): Promise<GetConversationMessagesResult> {
  if (!supabase || !isSupabaseConfigured) {
    console.error("Supabase is not configured.");
    throw new Error("Supabase is not configured.");
  }

  const effectiveLimit = Math.min(limit, 50); // Enforce max limit

  let query = supabase
    .from("agent_chat_messages")
    .select("id, session_id, role, content, created_at")
    .eq("session_id", conversationId);

  if (cursor) {
    // For ASC ordering of created_at, we want items with a later created_at
    // For items with the same created_at, we want items with a later id (due to id ASC)
    query = query.or(
      `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`
    );
  }

  query = query
    .order("created_at", { ascending: true })
    .order("id", { ascending: true }); // Tie-breaker for stable pagination

  const { data, error }: PostgrestResponse<ConversationMessage> = await query
    .limit(effectiveLimit + 1) // Fetch one extra to determine next cursor
    .execute();

  if (error) {
    console.error("Error getting conversation messages:", error);
    throw new Error(error.message);
  }

  const items = (data ?? []) as ConversationMessage[];
  const hasMore = items.length > effectiveLimit;
  const messagesToReturn = items.slice(0, effectiveLimit);

  let nextCursor: GetConversationMessagesResult["nextCursor"] | undefined;
  if (hasMore) {
    const firstMessageAfterLimit = items[items.length - 2]; // The second to last item is the last one to be displayed on current page
    nextCursor = {
      created_at: firstMessageAfterLimit.created_at,
      id: firstMessageAfterLimit.id,
    };
  }

  return {
    items: messagesToReturn,
    nextCursor: nextCursor,
  };
}

export async function updateConversationStatus(
  conversationId: string,
  newStatus: ConversationStatus,
  metadata: object
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) {
    console.error("Supabase is not configured.");
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase
    .from("conversations")
    .update({ 
      status: newStatus,
      last_message_metadata: metadata
    })
    .eq("id", conversationId);

  if (error) {
    console.error(`Error updating conversation ${conversationId} status to ${newStatus}:`, error);
    throw new Error(error.message);
  }
}

// --- Message Sending Functions ---

interface SendMessageParams {
  conversationId: string;
  content: string;
  senderType: 'human' | 'agent';
}

export async function sendMessage({ conversationId, content, senderType }: SendMessageParams): Promise<void> {
  // apiFetch requires an auth token, getAuthToken is a utility function in @/lib/utils
  const authToken = await getAuthToken();
  if (!authToken) {
    throw new Error("Authentication token not found.");
  }

  const payload = {
    conversation_id: conversationId,
    content: content,
    sender_type: senderType,
  };

  try {
    const response = await apiFetch(
      "/api/v1/channels/send",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      authToken
    );

    if (response.error) {
      throw new Error(response.error);
    }
    // No return value needed for success, backend handles persistence
  } catch (error: any) {
    console.error("Failed to send message:", error);
    throw new Error(error.message || "Failed to send message.");
  }
}
