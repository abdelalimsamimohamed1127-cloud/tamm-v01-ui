# Operations Notes for Tamm Production Launch

This document tracks operational readiness tasks and notes for the Tamm project's production launch.

## A) Database Backups & Recovery

### 1) Supabase Automated Backups

**Action Required:** Automated backups, retention policies, and Point-in-Time Recovery (PITR) must be configured in the Supabase project dashboard. These settings cannot be accessed or configured via the CLI.

Please ensure the following settings are applied to the production Supabase project:
- **Enable Automated Daily Backups:** Turn this feature on.
- **Set Retention Period:** Configure backups to be retained for at least 14 days.
- **Enable Point-in-Time Recovery (PITR):** Enable this feature for granular restore capabilities.

This is a manual verification step.

### 2) Backup Coverage Verification

**Status:** Verified

The following critical tables have been confirmed to exist in the database schema and will be included in backups:
- `workspaces`
- `workspace_users`
- `agents`
- `agent_channels`
- `conversations`
- `messages` (and related tables `channel_messages`, `chat_messages`)
- `usage_events`
- `workspace_wallets`
- `subscriptions`
- `payments` (named `payments`, not `payment_requests`)
- `audit_logs` (and related tables `channel_doc_audit_logs`, `external_api_audit_logs`)

### 3) Restore Test Procedure

**Action Required:** A manual restore test should be performed on a staging environment that is a recent clone of the production database.

**Recommended Steps:**

1.  **Create a Manual Backup:** From the Supabase dashboard of the staging project, create a new manual backup before proceeding.
2.  **Identify a Test Record:** Select a non-critical record from a table to modify or delete. For example, a record in the `workspaces` table in the staging environment. Note its `id`.
3.  **Perform a Destructive Action:** Delete the test record. For example: `DELETE FROM public.workspaces WHERE id = 'your-test-id';`
4.  **Verify Deletion:** Confirm that the record has been deleted by trying to select it.
5.  **Perform Restore:** From the Supabase dashboard, select the backup created in step 1 and initiate a restore.
6.  **Verify Restoration:** Once the restore is complete, verify that the deleted record now exists and its data is intact.
7.  **Document Outcome:** Record the success or failure of the restore test.

## B) SECURITY FINAL AUDIT

### 1) Secrets Management

**Status:** Partial Verification. Manual review required.

The goal is to ensure no secrets are stored in plaintext in the codebase or in the database.

-   **Frontend (`.env`, `src/`):**
    -   **Result:** **PASS**. The frontend code in `src/env.ts` correctly consumes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment variables. The Anon key is non-sensitive and designed for public client-side use. No hardcoded secrets were found in the frontend application code.

-   **`agent_channels.config`:**
    -   **Result:** **PASS (with notes)**. The database schema for `agent_channels` includes an explicit comment: `Non-secret channel configuration. Do not store secrets here.`. This indicates correct developer intent. No code was found that saves secrets to this column.

-   **`connectors.config_jsonb`:**
    -   **Result:** **NEEDS REVIEW**. There is a contradiction between the code and a database migration comment.
        -   The backend code that creates connectors (`backend/integrations/supabase_repo.py`) **does not** save any secrets to the `config_jsonb` field. It only saves non-sensitive metadata.
        -   However, a migration file (`supabase/migrations/20251226130000_add_connector_tables.sql`) has a comment that says `Encrypted configuration details (e.g., API keys, endpoint URLs)`.
        -   The connector integration feature appears to be incomplete, with TODOs in the code. It is possible that secrets are intended to be handled by a separate, not-yet-implemented mechanism (e.g., an Edge Function that uses Supabase secrets).
    -   **Recommendation:** A manual review of the `connectors` table in the production database is required to confirm that no secrets are present in the `config_jsonb` column.

-   **Backend Environment:**
    -   **Result:** **PASS**. The backend code correctly uses `os.getenv()` to access secrets like `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Supabase Edge Functions also correctly use `Deno.env.get()` for `OPENAI_API_KEY` and Supabase keys. This aligns with the rule that secrets should be in backend environment variables or Supabase Secrets.

### 2) API Keys

**Status:** Verified

-   **`workspace_api_keys` stores ONLY hashes:**
    -   **Result:** **PASS**. The `workspace_api_keys` table schema in `10.2_external_api_schema.sql` confirms that only a `key_hash` is stored, not the raw API key.
-   **Revoked keys fail immediately:**
    -   **Result:** **PASS**. The API key authentication function `get_api_key_and_workspace` in `backend/external_api/auth.py` explicitly checks if `status` is `'active'`. If the key is revoked (i.e., status is not `active`), it denies access.
-   **Raw keys never retrievable:**
    -   **Result:** **PASS**. The raw key is not stored in the database. The application hashes the key upon creation and for every verification. No code was found that would expose a raw key after its initial generation.


### 3) RLS Verification (manual tests)

**Status:** Verified (Code Review). Manual testing is still recommended.

A review of the RLS policies in the database migrations confirms that the policies are designed to correctly enforce security boundaries.

-   **Cross-workspace SELECT → FAIL:**
    -   **Result:** **PASS (in theory)**. Policies consistently use a `is_workspace_member` or similar function that checks if the acting user (`auth.uid()`) is a member of the workspace associated with the data they are trying to access. For example, the policy on the `workspaces` table itself prevents a user from seeing workspaces they are not a member of. This should prevent data leakage between workspaces.

-   **Member writing admin table → FAIL:**
    -   **Result:** **PASS (in theory)**. Tables that should be admin-only, like `user_roles`, have write policies that are restricted to users with the 'admin' role, checked via the `is_admin()` helper function. This prevents a regular 'member' from modifying admin-only data.

-   **Service-role ingestion → PASS:**
    -   **Result:** **PASS (by design)**. The Supabase `service_role` key is designed to bypass all RLS policies. The backend services that need to perform broad data operations are expected to use this key. This is a fundamental part of Supabase's security model and does not require specific RLS policies.

## C) BILLING & LIMIT ENFORCEMENT

### 1) Billing Sanity Checks

**Status:** Verified (Code Review).

-   **Paymob success → plan upgraded:**
    -   **Result:** **PASS (in theory)**. The `billing.subscriptions.update_subscription_and_workspace_plan` function is designed to be called by a Paymob webhook. It calls `activate_subscription` when it receives an 'active' status, which correctly upgrades the plan in the database. The webhook endpoint itself is not defined, but the logic is present.

-   **InstaPay confirmed → plan upgraded:**
    -   **Result:** **PASS**. The `billing.instapay.confirm_payment_request` function, called by an admin-only API endpoint, correctly calls `activate_subscription` to upgrade the plan after an InstaPay payment has been manually confirmed.

-   **No upgrade without confirmation:**
    -   **Result:** **PASS**. Both Paymob and InstaPay flows require a confirmation event (a webhook or a manual admin action) before the plan is upgraded.

-   **Credits never go negative:**
    -   **Result:** **PASS**. The `deduct_credits` PostgreSQL function in `20251226_ctf_core.sql` is robust. It uses a `SELECT ... FOR UPDATE` lock to prevent race conditions and explicitly checks if the balance is sufficient before making a deduction. Additionally, the `workspace_wallets` table has a `CHECK (balance >= 0)` constraint, providing database-level protection against negative balances.

### 2) Rate Limiting

**Status:** Verified (Code Review). Manual testing is still recommended.

-   **Free vs Paid limits verified:**
    -   **Result:** **PASS (in theory)**. The `RateLimitMiddleware` uses the user's `plan_key` to fetch the correct rate limits from the `RATE_LIMIT_CONFIG` dictionary in `backend/billing/rate_limit.py`. This ensures that users on different plans have different rate limits.

-   **429 returned correctly:**
    -   **Result:** **PASS**. The `RateLimitMiddleware` in `backend/billing/middleware.py` correctly returns a `JsonResponse` with status 429 and a `Retry-After` header when the rate limit is exceeded.

-   **Redis failure = fail-open:**
    -   **Result:** **PASS**. The `increment_and_check` function in `backend/billing/rate_limit.py` has a `try...except` block that catches Redis connection errors. In case of an error, it logs the error and returns `{"allowed": True, ...}`, effectively disabling rate limiting and allowing the request to proceed.

## D) ROLLBACK READINESS

**Status:** Process-driven. Requires procedural implementation.

Rollback readiness depends on deployment and operational procedures, not just code.

-   **Frontend:**
    -   **Result:** **PASS**. The project uses a `vercel.json` file, indicating deployment on Vercel. Vercel's platform automatically keeps previous deployments and allows for instant rollbacks to a last known-good deployment through their dashboard.

-   **Backend:**
    -   **Result:** **NEEDS PROCEDURE**. A process must be in place to record the last known-good deployment artifact.
    -   **Recommendation:**
        -   If using Docker, tag the last known-good image with a `last-known-good` tag.
        -   If deploying from Git, tag the last known-good commit with a `last-known-good` tag.
        -   The deployment script should be updated to record the image tag or commit hash of the currently deployed version.

-   **Database:**
    -   **Result:** **NEEDS PROCEDURE**.
        -   **No destructive migrations pending:** Before any deployment, a review must be conducted to ensure that no pending migrations are destructive (e.g., `DROP TABLE`, `DROP COLUMN`). Migrations should be written to be reversible where possible.
        -   **Restore point known:** Before a deployment, a manual backup of the production database should be taken from the Supabase dashboard. This backup serves as the immediate restore point in case of a catastrophic failure. This is in addition to the automated daily backups.

# PART 2: Operations & Incident Readiness

## A) MONITORING & ALERTING

**Status:** Good foundation, but requires implementation and manual configuration.

The codebase includes good logging practices that will serve as a foundation for monitoring and alerting. However, the alerts themselves must be configured in a monitoring platform (e.g., Supabase's built-in alerts, Datadog, etc.).

### 1) Platform Metrics

-   **Backend 5xx rate:**
    -   **Result:** **Ready for Alerting**. Django automatically logs 5xx errors. An alert can be configured on the log platform to trigger on a high rate of 5xx errors.
-   **Edge function errors:**
    -   **Result:** **Ready for Alerting**. The `run_agent` Edge Function has structured logging for errors. Alerts can be configured to trigger on these error logs.
-   **Webhook failures (WhatsApp, Messenger, Paymob):**
    -   **Result:** **NEEDS IMPLEMENTATION**. The views for receiving webhooks from WhatsApp, Messenger, and Paymob are missing from the codebase. Without these views, there is no way to monitor for their failure.
-   **External API auth failures:**
    -   **Result:** **Ready for Alerting**. `backend/external_api/auth.py` logs a warning when API key authentication fails. An alert can be configured on this log message.
-   **Rate limit spikes (429s):**
    -   **Result:** **Ready for Alerting**. `backend/billing/middleware.py` logs a warning when a workspace exceeds its rate limit. An alert can be configured on this log message.

### 2) Business Alerts

-   **Credits exhausted:**
    -   **Result:** **Ready for Alerting**. The `run_agent` Edge Function logs a warning when a workspace has insufficient credits. An alert can be configured on this log message.
-   **Payment webhook failures:**
    -   **Result:** **NEEDS IMPLEMENTATION**. This is dependent on the missing webhook views.
-   **Ingestion job failures:**
    -   **Result:** **NEEDS IMPLEMENTATION**. The ingestion job logic is not fully implemented. Error logging needs to be added once the jobs are complete.
-   **Signature verification failures:**
    -   **Result:** **Ready for Alerting**. `external_api/middleware.py` logs an error when HMAC signature verification fails. An alert can be configured on this log message.

## B) SCHEDULED JOBS

**Status:** Partially implemented. Requires scheduling configuration.

### 1) Verify jobs are LIVE

-   **Weekly insights generation:**
    -   **Result:** **NEEDS IMPLEMENTATION**. The logic for generating insights exists in `backend/analytics/insights.py`, but it is exposed as an API endpoint, not a scheduled job. This needs to be converted to a job and scheduled to run weekly.
-   **Retention cleanup:**
    -   **Result:** **Ready for Scheduling**. The `run_retention_cleanup` PostgreSQL function is well-defined in the migrations. This function needs to be scheduled to run daily, for example using `pg_cron` or an external scheduler.

### 2) Confirm

-   **Idempotency works:**
    -   **Result:** **PASS**. The `run_retention_cleanup` function is idempotent. Re-running it will not cause any issues.
-   **Partial failures logged:**
    -   **Result:** **N/A**. The `run_retention_cleanup` function is a single database transaction and does not have a partial failure mode.
-   **Jobs can be re-run manually:**
    -   **Result:** **PASS**. The `run_retention_cleanup` function can be run manually by calling `SELECT public.run_retention_cleanup();` in SQL.


## C) RETENTION POLICIES

**Status:** Verified.

A review of the `run_retention_cleanup` function in the database migrations was conducted.

-   **`audit_logs` are no longer being deleted.** The `DELETE FROM public.audit_logs` statement has been removed from the `run_retention_cleanup` function in `supabase/migrations/20251219130000_zip4_plan_limits_analytics_retention.sql`, aligning with the requirement that audit logs should be retained indefinitely.

-   **Cleanup of `webhook payloads` and `ingestion artifacts` is not implemented.** The retention job does not clean up any tables that appear to store webhook payloads or temporary ingestion artifacts. This could lead to data accumulating indefinitely and should be addressed in a future task.

-   **Billing data and usage events are NOT deleted.** The retention job correctly avoids deleting data from billing-related tables and `usage_events`.



## D) INCIDENT RESPONSE PLAYBOOK

**Status:** Drafted.

This playbook provides a set of initial steps for responding to common incidents.

### 1) Kill Switches

These are manual database operations to quickly disable parts of the system.

-   **Disable a workspace:**
    -   **Action:** There is no built-in `status` field on the `workspaces` table. To disable a workspace, the recommended approach is to update its plan to a disabled state.
    -   **SQL:** `UPDATE public.subscriptions SET status = 'canceled' WHERE workspace_id = 'your-workspace-id';`
    -   **Effect:** This will prevent the workspace from accessing paid features. The application logic should be reviewed to ensure this has the desired effect.

-   **Revoke an API key:**
    -   **Action:** Update the status of the API key to `revoked`.
    -   **SQL:** `UPDATE public.workspace_api_keys SET status = 'revoked' WHERE id = 'your-api-key-id';`
    -   **Effect:** The API key will immediately fail authentication.

-   **Disable a webhook/channel:**
    -   **Action:** Set the `is_active` flag on the `agent_channels` table to `false`.
    -   **SQL:** `UPDATE public.agent_channels SET is_active = false WHERE id = 'your-channel-id';`
    -   **Effect:** The `run_agent` Edge Function checks this flag, so this will prevent the agent from responding to messages. The code for sending messages should also check this flag.

-   **Pause an ingestion job:**
    -   **Action:** Set the `is_active` flag on the `connectors` table to `false`.
    -   **SQL:** `UPDATE public.connectors SET is_active = false WHERE id = 'your-connector-id';`
    -   **Effect:** The ingestion job runner should check this flag before starting a job.

### 2) Common Incidents

-   **Payment outage (Paymob/InstaPay):**
    -   **Symptom:** Users report that they cannot upgrade their plan. Alerts are firing for payment webhook failures.
    -   **Steps:**
        1.  Check the status page of the payment provider.
        2.  Check the application logs for errors related to the payment provider.
        3.  If the provider is down, post a status update to users.
        4.  If the issue is in the application code, escalate to the backend team.

-   **WhatsApp/Messenger downtime:**
    -   **Symptom:** Users report that they are not receiving messages from the bot. Alerts are firing for webhook failures.
    -   **Steps:**
        1.  Check the status page of the channel provider (Meta).
        2.  Check the application logs for errors related to the channel.
        3.  If the provider is down, post a status update to users.
        4.  If the issue is in the application code, escalate to the channels team.

-   **LLM provider failure (OpenAI):**
    -   **Symptom:** The bot is not responding, or is responding with errors. Alerts are firing for Edge Function errors.
    -   **Steps:**
        1.  Check the status page of the LLM provider (OpenAI).
        2.  Check the logs for the `run_agent` Edge Function for errors.
        3.  If the provider is down, post a status update to users.

-   **Billing mismatch:**
    -   **Symptom:** A user reports that they were billed incorrectly or that their plan was not upgraded after payment.
    -   **Steps:**
        1.  Manually inspect the `subscriptions` and `payments` tables for the user's workspace.
        2.  Compare with the data from the payment provider's dashboard.
        3.  If there is a discrepancy, escalate to the payments team to reconcile the data.

### 3) Ownership

-   **Backend:** Backend Engineering Team
-   **Payments:** Billing Team / Finance
-   **Channels:** Channels Team / Partner Integrations
-   **Customer support:** Customer Support Team

## E) FINAL DRY-RUN

**Status:** Pending.

The following manual tests should be performed in a staging environment that is as close to production as possible before go-live.

-   **WhatsApp webhook end-to-end:**
    -   **Action:** Send a message to the WhatsApp number associated with an agent and verify that the agent responds.
    -   **Note:** This is currently blocked as the webhook view is not implemented.
-   **Messenger webhook:**
    -   **Action:** Send a message to the Facebook Page associated with an agent and verify that the agent responds.
    -   **Note:** This is currently blocked as the webhook view is not implemented.
-   **Webchat embed on external site:**
    -   **Action:** Embed the webchat widget on a test website and verify that it loads and can be used to chat with an agent.
-   **Create/revoke API key:**
    -   **Action:** Create a new API key, use it to make a successful API call, then revoke it and verify that the API call fails.
-   **Trigger connector sync:**
    -   **Action:** Trigger a sync for a connector and verify that the data is ingested correctly.
    -   **Note:** This may be blocked as the connector functionality is incomplete.
-   **Generate insights:**
    -   **Action:** Call the insights generation API endpoint and verify that insights are generated and stored correctly.
-   **Run reconciliation report:**
    -   **Action:** There is no reconciliation report mentioned in the codebase. This needs to be defined and implemented.







