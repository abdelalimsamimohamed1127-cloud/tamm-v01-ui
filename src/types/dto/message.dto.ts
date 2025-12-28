export interface MessageDTO {
  id: string;
  workspace_id: string;
  agent_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}
