export interface Automation {
  id: string;
  workspace_id: string;
  key: string;
  enabled: boolean;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}
