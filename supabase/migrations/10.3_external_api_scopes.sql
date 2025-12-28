-- Migration SQL for TASK 10.3 – External API: Permissions & Scopes System

-- Add 'scopes' column to public.workspace_api_keys
ALTER TABLE public.workspace_api_keys
ADD COLUMN IF NOT EXISTS scopes jsonb NULL;

-- Add 'scopes_used' and 'permission_granted' columns to public.external_api_audit_logs
ALTER TABLE public.external_api_audit_logs
ADD COLUMN IF NOT EXISTS scopes_used jsonb NULL;

ALTER TABLE public.external_api_audit_logs
ADD COLUMN IF NOT EXISTS permission_granted boolean NULL;
