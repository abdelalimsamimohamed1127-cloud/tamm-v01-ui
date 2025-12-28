-- Enable RLS on the workspaces table
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "workspaces_select_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_update_delete_policy" ON public.workspaces;

-- Policy for SELECT operations: Members can read their own workspace
CREATE POLICY "workspaces_select_policy"
ON public.workspaces
FOR SELECT
USING (is_workspace_member(id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify their workspace
CREATE POLICY "workspaces_insert_update_delete_policy"
ON public.workspaces
FOR ALL
TO authenticated -- Apply to authenticated users
USING (is_workspace_admin(id))
WITH CHECK (is_workspace_admin(id));

-- Enable RLS on the workspace_users table
ALTER TABLE public.workspace_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "workspace_users_select_policy" ON public.workspace_users;
DROP POLICY IF EXISTS "workspace_users_insert_update_delete_policy" ON public.workspace_users;

-- Policy for SELECT operations: Members can read workspace_users entries for their own workspace
CREATE POLICY "workspace_users_select_policy"
ON public.workspace_users
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify workspace_users for their workspace
CREATE POLICY "workspace_users_insert_update_delete_policy"
ON public.workspace_users
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the agents table
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "agents_select_policy" ON public.agents;
DROP POLICY IF EXISTS "agents_insert_update_delete_policy" ON public.agents;

-- Policy for SELECT operations: Members can read agents in their own workspace
CREATE POLICY "agents_select_policy"
ON public.agents
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify agents in their workspace
CREATE POLICY "agents_insert_update_delete_policy"
ON public.agents
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the agent_channels table
ALTER TABLE public.agent_channels ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "agent_channels_select_policy" ON public.agent_channels;
DROP POLICY IF EXISTS "agent_channels_insert_update_delete_policy" ON public.agent_channels;

-- Policy for SELECT operations: Members can read agent channels in their own workspace
CREATE POLICY "agent_channels_select_policy"
ON public.agent_channels
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify agent channels in their workspace
CREATE POLICY "agent_channels_insert_update_delete_policy"
ON public.agent_channels
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the conversations table
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_update_delete_policy" ON public.conversations;

-- Policy for SELECT operations: Members can read conversations in their own workspace
CREATE POLICY "conversations_select_policy"
ON public.conversations
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify conversations in their workspace
CREATE POLICY "conversations_insert_update_delete_policy"
ON public.conversations
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_update_delete_policy" ON public.messages;

-- Policy for SELECT operations: Members can read messages in their own workspace
CREATE POLICY "messages_select_policy"
ON public.messages
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify messages in their workspace
CREATE POLICY "messages_insert_update_delete_policy"
ON public.messages
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_update_delete_policy" ON public.orders;

-- Policy for SELECT operations: Members can read orders in their own workspace
CREATE POLICY "orders_select_policy"
ON public.orders
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify orders in their workspace
CREATE POLICY "orders_insert_update_delete_policy"
ON public.orders
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the tickets table
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "tickets_select_policy" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert_update_delete_policy" ON public.tickets;

-- Policy for SELECT operations: Members can read tickets in their own workspace
CREATE POLICY "tickets_select_policy"
ON public.tickets
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify tickets in their workspace
CREATE POLICY "tickets_insert_update_delete_policy"
ON public.tickets
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the automations table
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "automations_select_policy" ON public.automations;
DROP POLICY IF EXISTS "automations_insert_update_delete_policy" ON public.automations;

-- Policy for SELECT operations: Members can read automations in their own workspace
CREATE POLICY "automations_select_policy"
ON public.automations
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify automations in their workspace
CREATE POLICY "automations_insert_update_delete_policy"
ON public.automations
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the usage_events table
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "usage_events_select_policy" ON public.usage_events;
DROP POLICY IF EXISTS "usage_events_insert_update_delete_policy" ON public.usage_events;

-- Policy for SELECT operations: Members can read usage events in their own workspace
CREATE POLICY "usage_events_select_policy"
ON public.usage_events
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify usage events in their workspace
CREATE POLICY "usage_events_insert_update_delete_policy"
ON public.usage_events
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the workspace_wallets table
ALTER TABLE public.workspace_wallets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "workspace_wallets_select_policy" ON public.workspace_wallets;
DROP POLICY IF EXISTS "workspace_wallets_insert_update_delete_policy" ON public.workspace_wallets;

-- Policy for SELECT operations: Members can read their own workspace wallet
CREATE POLICY "workspace_wallets_select_policy"
ON public.workspace_wallets
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify workspace wallets in their workspace
CREATE POLICY "workspace_wallets_insert_update_delete_policy"
ON public.workspace_wallets
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the subscriptions table
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "subscriptions_select_policy" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_update_delete_policy" ON public.subscriptions;

-- Policy for SELECT operations: Members can read their own workspace's subscriptions
CREATE POLICY "subscriptions_select_policy"
ON public.subscriptions
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify subscriptions in their workspace
CREATE POLICY "subscriptions_insert_update_delete_policy"
ON public.subscriptions
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the payment_requests table
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "payment_requests_select_policy" ON public.payment_requests;
DROP POLICY IF EXISTS "payment_requests_insert_update_delete_policy" ON public.payment_requests;

-- Policy for SELECT operations: Members can read their own workspace's payment requests
CREATE POLICY "payment_requests_select_policy"
ON public.payment_requests
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify payment requests in their workspace
CREATE POLICY "payment_requests_insert_update_delete_policy"
ON public.payment_requests
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the connectors table
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "connectors_select_policy" ON public.connectors;
DROP POLICY IF EXISTS "connectors_insert_update_delete_policy" ON public.connectors;

-- Policy for SELECT operations: Members can read connectors in their own workspace
CREATE POLICY "connectors_select_policy"
ON public.connectors
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify connectors in their workspace
CREATE POLICY "connectors_insert_update_delete_policy"
ON public.connectors
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the ingestion_logs table
ALTER TABLE public.ingestion_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "ingestion_logs_select_policy" ON public.ingestion_logs;
DROP POLICY IF EXISTS "ingestion_logs_insert_update_delete_policy" ON public.ingestion_logs;

-- Policy for SELECT operations: Members can read ingestion logs in their own workspace
CREATE POLICY "ingestion_logs_select_policy"
ON public.ingestion_logs
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify ingestion logs in their workspace
CREATE POLICY "ingestion_logs_insert_update_delete_policy"
ON public.ingestion_logs
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the external_events table
ALTER TABLE public.external_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "external_events_select_policy" ON public.external_events;
DROP POLICY IF EXISTS "external_events_insert_update_delete_policy" ON public.external_events;

-- Policy for SELECT operations: Members can read external events in their own workspace
CREATE POLICY "external_events_select_policy"
ON public.external_events
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify external events in their workspace
CREATE POLICY "external_events_insert_update_delete_policy"
ON public.external_events
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the workspace_api_keys table
ALTER TABLE public.workspace_api_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "workspace_api_keys_select_policy" ON public.workspace_api_keys;
DROP POLICY IF EXISTS "workspace_api_keys_insert_update_delete_policy" ON public.workspace_api_keys;

-- Policy for SELECT operations: Members can read API keys in their own workspace
CREATE POLICY "workspace_api_keys_select_policy"
ON public.workspace_api_keys
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify API keys in their workspace
CREATE POLICY "workspace_api_keys_insert_update_delete_policy"
ON public.workspace_api_keys
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));

-- Enable RLS on the external_api_audit_logs table
ALTER TABLE public.external_api_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (idempotent)
DROP POLICY IF EXISTS "external_api_audit_logs_select_policy" ON public.external_api_audit_logs;
DROP POLICY IF EXISTS "external_api_audit_logs_insert_update_delete_policy" ON public.external_api_audit_logs;

-- Policy for SELECT operations: Members can read external API audit logs in their own workspace
CREATE POLICY "external_api_audit_logs_select_policy"
ON public.external_api_audit_logs
FOR SELECT
USING (is_workspace_member(workspace_id));

-- Policy for INSERT, UPDATE, DELETE operations: Only admins can modify external API audit logs in their workspace
CREATE POLICY "external_api_audit_logs_insert_update_delete_policy"
ON public.external_api_audit_logs
FOR ALL
TO authenticated
USING (is_workspace_admin(workspace_id))
WITH CHECK (is_workspace_admin(workspace_id));
