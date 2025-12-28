export interface WorkspaceWalletDTO {
  workspace_id: string;
  credits_remaining: number;
  credits_used: number;
}

export interface WorkspacePlanDTO {
  workspace_id: string;
  plan_key: "free" | "starter" | "pro";
}
