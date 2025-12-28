import { runAgentStream, AgentRuntimeRequest } from '@/lib/agentRuntime';

type StreamHandler = (chunk: string) => void;

export async function sendMessageToAgent(
  agentId: string,
  message: string,
  sessionId?: string, // Make sessionId optional as it is in AgentRuntimeRequest
  mode: "test" | "live" = "live", // Add mode with default
  onChunk: StreamHandler,
): Promise<void> {
  const request: AgentRuntimeRequest = {
    agent_id: agentId,
    message: message,
    session_id: sessionId,
    mode: mode,
  };

  await runAgentStream(request, (event) => {
    if (event.type === "token" && event.content) {
      onChunk(event.content);
    }
    if (event.type === "error" && event.content) {
        console.error("Error from agent runtime:", event.content);
        // In a real scenario, onChunk might be used to display an error message to the user
        // or a different error callback passed. For now, logging.
    }
  });
}
