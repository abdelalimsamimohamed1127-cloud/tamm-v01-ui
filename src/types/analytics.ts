// src/types/analytics.ts
// Add this new file for types used in analytics

export interface Insight {
  id: string;
  workspace_id: string;
  period_start: string; // ISO date string
  period_end: string;   // ISO date string
  insight_type: string;
  title: string;
  summary: string;
  payload: Record<string, any>; // JSONB field
  created_at: string;   // ISO datetime string
}
