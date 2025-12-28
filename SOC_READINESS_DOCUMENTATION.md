### Internal Security Documentation for Tamm – AI Social Commerce Copilot

**Date:** 2025-12-27
**Auditor:** Gemini AI Agent
**Project:** Tamm – AI Social Commerce Copilot
**Scope:** Enterprise security hardening across API, webhooks, data, and ops (SOC-ready)

---

#### **1. API Security (External API)**

**1.1 IP Allowlist (Workspace/API Key Level)**
*   **Implementation:** An optional IP allowlist is supported via the `allowed_ips` configuration within `workspace_api_keys.config` (JSONB field).
*   **Enforcement:** Implemented in `backend/external_api/middleware.py`. If a request's IP address is not within the configured allowlist for the associated API key, the request is blocked with a `403 Forbidden` response.
*   **Auditing:** `ip_blocked` events are logged to the central audit stream (`external_api_audit_logs`) with `client_ip` and `allowed_ips_config` metadata.

**1.2 Optional HMAC Request Signing (Enterprise)**
*   **Implementation:** Support for `X-Tamm-Timestamp` and `X-Tamm-Signature` (HMAC-SHA256) headers.
*   **Enforcement:** Implemented in `backend/external_api/middleware.py`. HMAC signing is optional per API key, activated by the presence of a `hmac_secret` in `workspace_api_keys.config`. Requests are rejected with `403 Forbidden` if timestamp skew exceeds 5 minutes or if the signature mismatches.
*   **Auditing:** `hmac_missing_headers` and `signature_failed` events are logged to the central audit stream (`external_api_audit_logs`) with relevant metadata (e.g., `client_ip`, `timestamp`, `signature_received`).

**1.3 Replay Protection**
*   **Implementation:** For `POST /events` endpoints, the `Idempotency-Key` header is required.
*   **Enforcement:** Implemented in `backend/external_api/views.py`. Used `Redis` to store used `Idempotency-Key`s for a short term (10 minutes TTL) to prevent rapid replay attacks.
*   **Auditing:** `idempotency_key_missing` and `replay_blocked` events are logged to the central audit stream (`external_api_audit_logs`) with the `idempotency_key` metadata.

---

#### **2. Webhook Security (Meta/Paymob/etc.)**

**2.1 Signature Verification**
*   **Implementation:** Verified for WhatsApp, Messenger, and Paymob webhooks (Edge Functions).
*   **Enforcement:**
    *   **WhatsApp (`supabase/functions/webhooks/whatsapp/index.ts`):** Verifies `X-Hub-Signature-256` using `appSecret` from environment variables.
    *   **Messenger (`supabase/functions/webhooks/messenger/index.ts`):** Verifies `X-Hub-Signature-256` using `appSecret` from environment variables.
    *   **Paymob (`supabase/functions/paymob_webhook/index.ts`):** Verifies HMAC (SHA-512) using `PAYMOB_HMAC_SECRET` from environment variables.
*   **Auditing:** `signature_failed` events are logged to the central audit stream (`external_api_audit_logs`) for all webhook types when verification fails.

**2.2 Replay Protection**
*   **Implementation:** Verified for WhatsApp, Messenger, and Paymob webhooks (Edge Functions).
*   **Enforcement:**
    *   **WhatsApp/Messenger:** Uses `external_message_id` and `agent_chat_messages` table for idempotency, preventing duplicate message processing.
    *   **Paymob:** Uses `provider_subscription_id` (Paymob transaction ID) in the `subscriptions` table for idempotency, preventing duplicate subscription updates.
*   **Auditing:** `webhook_duplicate_received` events are logged to the central audit stream (`external_api_audit_logs`) when a duplicate is detected and skipped.

**2.3 Strict Parsing**
*   **Implementation:** All webhook Edge Functions (`whatsapp`, `messenger`, `paymob_webhook`) are designed with strict parsing.
*   **Enforcement:**
    *   Validate expected object structures and required fields.
    *   Safely ignore unknown event types or malformed payloads, typically by logging a warning and returning `200 OK` (for non-fatal issues) to prevent retry storms.
    *   Return appropriate `4xx` status codes for client-side errors (e.g., invalid data, signature mismatch) and `500 Internal Server Error` for critical internal processing failures (e.g., DB errors, upstream service failures), preventing uncaught errors.

---

#### **3. Secrets Management**

**3.1 No Plaintext Secrets in DB**
*   **Where each secret is stored:** Actual secrets (e.g., app secrets, access tokens) are stored in Supabase Secrets (environment variables) or Django backend environment variables.
*   **How they are referenced:** The database (e.g., `agent_channels.config`) stores only string references (`*_ref` fields, such as `app_secret_ref`, `verify_token_ref`) to these environment variables.
*   **Who can access it:**
    *   Supabase Edge Functions: Access via `Deno.env.get()` using the `SUPABASE_SERVICE_ROLE_KEY`.
    *   Django Backend: Access via `os.getenv()` or Django settings.

**3.2 Rotation Support**
*   **Mechanism:** The `*_ref` naming convention inherently supports secret versioning. A new secret can be introduced in environment variables (e.g., `WHATSAPP_SECRET_V2`), and the `agent_channels.config.app_secret_ref` can be updated to point to the new reference. This allows for controlled rollout and rollback.
*   **Process:** To rotate a secret, a new environment variable (e.g., `WHATSAPP_SECRET_V3`) is added. The `app_secret_ref` in `agent_channels.config` is then updated to point to `WHATSAPP_SECRET_V3`. The old secret can be deprecated and removed after all integrations have migrated.

---

#### **4. Data Access & RLS Hardening**

**4.1 RLS Enabled on ALL Core Tables**
*   **Implementation:** Row Level Security (RLS) is enabled for all core tables: `workspaces`, `workspace_users`, `agents`, `agent_channels`, `conversations`, `messages`, `orders`, `tickets`, `automations`, `usage_events`, `workspace_wallets`, `subscriptions`, `payment_requests`, `connectors`, `ingestion_logs`, `external_events`, `workspace_api_keys`, `external_api_audit_logs`, `analytics_insights`.
*   **Policies:** Idempotent SQL commands to enable RLS and create `SELECT` and `FOR ALL (INSERT/UPDATE/DELETE)` policies are detailed in `rls_policies.sql`.

**4.2 Least Privilege Policies**
*   **Members:** `SELECT` access is granted only where `is_workspace_member(workspace_id)` is true.
*   **Admins:** `INSERT`, `UPDATE`, `DELETE` access is restricted to administrators where `is_workspace_admin(workspace_id)` is true (enforced via `USING` and `WITH CHECK`).
*   **Service Role:** Service roles (e.g., Supabase Edge Functions using `SUPABASE_SERVICE_ROLE_KEY` or Django background tasks) implicitly bypass RLS. This bypass is assumed for system-level operations like ingestion, scheduled jobs, and audit logging. Each bypass is explicit in the application code where the service role client is used.

**4.3 Prevent PII Leakage**
*   **Analytics Views:** It is assumed that existing analytics views or queries are designed to exclude or redact Personally Identifiable Information (PII) before exposure. *Verification needed: Manual review of analytics data pipelines and views.*
*   **External API Endpoints:** It is assumed that `external_api` serializers and view logic are implemented to never return PII by default. *Verification needed: Manual review of `backend/external_api/serializers.py` and associated view logic.*

---

#### **5. Audit Logging (SOC-ready)**

**5.1 Central Audit Stream**
*   **Implementation:** A central audit logging helper (`backend/security/audit.py:log_audit_event` for Django and `supabase/functions/_shared/observability.ts:writeAuditLog` for Edge Functions) is used. Both log to the `external_api_audit_logs` table.
*   **Integration:** Audit logging is integrated into `external_api` middleware, `billing` services, and all webhook Edge Functions.

**5.2 Audit Events & Fields**
*   **Events Logged:**
    *   `api_call` (general API request), `api_auth_failed`, `ip_blocked`, `signature_failed` (API keys)
    *   `webhook_received`, `webhook_duplicate_received`, `signature_failed` (Webhooks)
    *   `billing.payment_confirmed`, `billing.payment_failed`, `billing.plan_changed` (Billing)
    *   `message_inserted` (Webhook message processing)
    *   `error` (General system errors caught by `captureError`)
*   **Audit Fields:** All required fields are captured: `workspace_id`, `actor` (`user_id` or `api_key_id`), `action`, `resource` (`endpoint`, `subscription_id`, etc.), `request_id`, `ip` (`ip_address`), `user_agent`, `created_at`, `metadata jsonb`.
*   **Append-Only:** Logs are inserted as new rows into `external_api_audit_logs` table, ensuring immutability.

---

#### **6. Monitoring & Alerting (Minimum SOC Signals)**

*   **Signals Emitter:** The central audit logging mechanism (`external_api_audit_logs` table) emits all necessary data points to derive required monitoring signals.
    *   `auth_fail_rate (API keys)`: Count `api_auth_failed` actions.
    *   `signature_fail_rate (webhooks)`: Count `signature_failed` actions (both API and webhooks).
    *   `429 rate limit hits`: Logged as `action="rate_limit_exceeded"` in `external_api_audit_logs` (placeholder in `backend/external_api/middleware.py`).
    *   `credit exhaustion events`: Logged via `backend/billing/audit.py` (e.g., `billing.credit_exhaustion`).
    *   `admin confirmations volume`: Logged when admin actions are performed (e.g., `admin_confirm_action`).
    *   `ingestion failures`: Logged via `captureError` (e.g., `action='error'`, `entity_type='whatsapp_webhook_insert'`).
    *   `unusual event spikes per workspace`: Requires aggregation/analysis of `webhook_received`, `api_call` grouped by `workspace_id`.
    *   `webhook retries`: Count `webhook_duplicate_received` actions.
*   **Alert Thresholds:** Configuration of alert thresholds (`> X signature failures / 5 min`, etc.) is outside the scope of code implementation and requires integration with a dedicated monitoring and alerting system (e.g., Splunk, ELK Stack, Datadog) that can query and analyze the audit logs.

---

#### **7. Incident Response Readiness**

**7.1 Kill Switches**
*   **Workspace-level `disable external_api`**: Requires adding an `is_external_api_enabled` flag to `workspaces` table (schema change - out of scope) and checking it in `ExternalApiAuthMiddleware`.
*   **Workspace-level `disable webhooks`**: Achieved by updating the `status` of all `agent_channels` for a given workspace to `disconnected` (management action).
*   **API-key-level `revoke key immediately`**: Achieved by updating `workspace_api_keys.status` to `revoked`. This is checked by `ExternalApiAuthMiddleware`.
*   **API-key-level `block by IP`**: Achieved by updating `workspace_api_keys.config.allowed_ips` for the specific key. This is enforced by `ExternalApiAuthMiddleware`.

**7.2 Forensics**
*   **Capability:** The central audit log (`external_api_audit_logs`) captures all necessary fields (`workspace_id`, `actor`, `request_id`, `ip`, `created_at`) to enable powerful forensic investigations via direct database queries or specialized log analysis tools.

---

#### **8. Verification (Manual Testing Required)**

**8.1 Client Access Verification (E)**
*   **Test:** Attempt to read `agent_channels.config` (sensitive parts), `workspace_api_keys`, or `payment_requests` directly from the client using a Supabase Anon Key. **Expected: MUST FAIL.**
*   **Test:** As an authenticated user, attempt to access data from a workspace they are *not* a member of. **Expected: MUST FAIL.**
*   **Test:** Review frontend code and client-callable Edge Functions for any accidental hardcoded secrets or leaks.

**8.2 Operational Verification (G)**
*   **Test:** Perform direct client-side requests attempting to query database tables or invoke functions that could expose secrets. **Expected: MUST BE DENIED.**
*   **Test:** Authenticated user from Workspace A attempts to retrieve data from Workspace B. **Expected: MUST BE DENIED.**
*   **Test:** Non-admin member attempts `INSERT/UPDATE/DELETE` on a restricted table within their workspace. **Expected: MUST BE DENIED.**
*   **Test:** Service role (e.g., an Edge Function with service key) performs `INSERT` into `usage_events` or `ingestion_logs`. **Expected: MUST PASS.**

---

This documentation provides a comprehensive overview of the security hardening implementations and necessary verification steps to ensure the Tamm AI Social Commerce Copilot platform is SOC-ready.

---