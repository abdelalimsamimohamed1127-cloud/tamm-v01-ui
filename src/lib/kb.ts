import { apiFetch } from "@/lib/apiClient";
import { getAuthToken } from "@/lib/utils";

export async function retrainAgentKnowledge(agentId: string): Promise<{ jobId?: string; message: string }> {
  const authToken = await getAuthToken();
  if (!authToken) {
    throw new Error("Authentication token not found.");
  }

  const response = await apiFetch(
    "/api/v1/knowledge/retrain",
    {
      method: "POST",
      body: JSON.stringify({ agent_id: agentId }),
    },
    authToken
  );

  if (response.error) {
    throw new Error(response.error);
  }

  return response.data as { jobId?: string; message: string };
}