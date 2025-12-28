-- Migration SQL for TASK 10.4 – External API: Versioning & Deprecation Strategy

-- Add 'api_version' column to public.external_api_audit_logs
ALTER TABLE public.external_api_audit_logs
ADD COLUMN IF NOT EXISTS api_version text NULL;

-- Add 'deprecated_used' column to public.external_api_audit_logs
ALTER TABLE public.external_api_audit_logs
ADD COLUMN IF NOT EXISTS deprecated_used boolean NULL;
