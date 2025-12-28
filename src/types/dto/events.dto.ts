export interface ExternalEventDTO {
  id: string;
  workspace_id: string;
  event_type: string;
  payload: Record<string, any>; // Using Record<string, any> for flexibility
  created_at: string;
}
