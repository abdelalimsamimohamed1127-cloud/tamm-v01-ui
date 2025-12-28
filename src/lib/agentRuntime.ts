// src/lib/agentRuntime.ts

/**
 * Stage 0.3 – Runtime Contract Unification
 *
 * This file defines the single runtime contract for all chat UIs.
 * The canonical executor for chat runtime is currently the Supabase Edge Function: `run_agent`.
 * In the future, this may be replaced by a Django runtime (e.g., `/api/v1/agent/run`).
 *
 * UI components and other parts of the frontend MUST NEVER call the runtime directly.
 * All runtime invocations must go through the `runAgentStream` function exported from this file.
 * This ensures a single point of control and allows for future changes to the backend runtime
 * without requiring modifications across the entire frontend.
 */

import { supabase } from '@/lib/supabase'; // Assuming supabase client is available

export interface AgentRuntimeRequest {
  agent_id: string;
  message: string;
  session_id?: string;
  mode: "test" | "live";
}

export interface AgentRuntimeStreamEvent {
  type: "token" | "done" | "error";
  content?: string;
}

/**
 * Invokes the agent runtime and handles its streaming response.
 * Normalizes events into a consistent format.
 *
 * @param req The request payload for the agent runtime.
 * @param onEvent Callback function to handle each streaming event.
 */
export async function runAgentStream(
  req: AgentRuntimeRequest,
  onEvent: (e: AgentRuntimeStreamEvent) => void
): Promise<void> {
  const requestId = crypto.randomUUID(); // Generate UUID for request ID

  try {
    const { data, error } = await supabase.functions.invoke("run_agent", {
      body: JSON.stringify(req),
      headers: { // Attach X-Request-ID header
        "X-Request-ID": requestId,
      },
    });

    if (error) {
      const errorMessage = `Supabase function invocation error: ${error.message}`;
      console.warn(`[${requestId}] ${errorMessage}`); // Log with request_id
      onEvent({ type: "error", content: errorMessage });
      return;
    }

    if (data === null || data === undefined) {
        const errorMessage = "No response data from agent runtime.";
        console.warn(`[${requestId}] ${errorMessage}`); // Log with request_id
        onEvent({ type: "error", content: errorMessage });
        return;
    }

    // Assuming `supabase.functions.invoke` aggregates the `text/plain` stream
    // from the Edge Function into a single string in its `data` property.
    if (typeof data === 'string') {
        // Simulate token by token for the frontend consumption
        const tokens = data.split(/(?<=\s)/); // Split by whitespace, keeping whitespace with token
        for (const token of tokens) {
            if (token) {
                onEvent({ type: "token", content: token });
            }
        }
        onEvent({ type: "done" });
    } else {
        // Fallback for unexpected data format
        const errorMessage = `Unexpected response format from run_agent invoke data: ${JSON.stringify(data)}`;
        console.warn(`[${requestId}] ${errorMessage}`); // Log with request_id
        onEvent({ type: "error", content: errorMessage });
    }

  } catch (e: any) {
    const errorMessage = `Error during agent runtime invocation: ${e.message || "An unknown error occurred."}`;
    console.warn(`[${requestId}] ${errorMessage}`); // Log with request_id
    // NEVER throw unhandled errors
    onEvent({ type: "error", content: errorMessage });
  }
}
