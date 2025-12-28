-- This file is for REFERENCE ONLY. Do not apply to the DB.
-- It documents the state of the analytics views as of 2025-12-27.

-- =================================================================
-- Main timeseries view for top-level KPIs
-- =================================================================
CREATE OR REPLACE VIEW public.daily_stats AS
SELECT
    d.date,
    w.id AS workspace_id,
    -- NOTE: agent_id is intentionally omitted for this high-level view
    --       to avoid fan-out issues. Agent-specific stats should be
    --       queried from a different, more granular view if needed.
    COALESCE(c.conversations_count, 0) AS conversations_count,
    COALESCE(m.messages_count, 0) AS messages_count,
    COALESCE(o.orders_count, 0) AS orders_count,
    COALESCE(o.total_revenue, 0.0) AS revenue_total -- NOTE: Column name is revenue_total
FROM
    (SELECT generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE,
        '1 day'::interval
    )::date AS date) d
CROSS JOIN
    (SELECT id FROM public.workspaces) w
LEFT JOIN
    (SELECT
        DATE(created_at) AS date,
        workspace_id,
        COUNT(id) AS conversations_count
    FROM public.agent_chat_sessions
    GROUP BY 1, 2) c ON d.date = c.date AND w.id = c.workspace_id
LEFT JOIN
    (SELECT
        DATE(created_at) AS date,
        workspace_id,
        COUNT(id) AS messages_count
    FROM public.agent_chat_messages
    GROUP BY 1, 2) m ON d.date = m.date AND w.id = m.workspace_id
LEFT JOIN
    (SELECT
        DATE(created_at) AS date,
        workspace_id,
        COUNT(id) AS orders_count,
        SUM(total_price) AS total_revenue
    FROM public.orders
    GROUP BY 1, 2) o ON d.date = o.date AND w.id = o.workspace_id;


-- =================================================================
-- View for channel-level activity breakdown
-- =================================================================
CREATE OR REPLACE VIEW public.channel_daily_activity AS
SELECT
    DATE(s.created_at) as activity_date,
    s.workspace_id,
    ac.platform as channel_platform, -- NOTE: channel_platform, not 'channel'
    COUNT(DISTINCT s.id) as conversation_count, -- NOTE: conversation_count, not 'conversations_count'
    COUNT(m.id) as message_count -- NOTE: message_count, not 'messages_count'
FROM
    public.agent_chat_sessions s
JOIN
    public.agent_channels ac ON s.agent_channel_id = ac.id
LEFT JOIN
    public.agent_chat_messages m ON s.id = m.session_id
GROUP BY
    1, 2, 3;


-- =================================================================
-- Raw event table for usage metrics (e.g., AI credits)
-- This is a TABLE, not a view.
-- =================================================================
-- public.usage_events already exists.
-- Relevant columns:
-- - id (uuid)
-- - workspace_id (uuid)
-- - agent_id (uuid)
-- - event_type (text, e.g., 'ai_completion', 'embedding_token')
-- - quantity (integer)
-- - created_at (timestamptz)

-- =================================================================
-- View for agent-level performance breakdown
-- =================================================================
CREATE OR REPLACE VIEW public.agent_daily_performance AS
SELECT
    DATE(s.created_at) as activity_date,
    s.workspace_id,
    s.agent_id,
    a.name as agent_name,
    a.model as agent_model,
    COUNT(DISTINCT s.id) as sessions_count,
    COUNT(m.id) as total_messages, -- NOTE: total_messages
    COALESCE(SUM(o.total_price), 0.0) as revenue_generated -- NOTE: revenue_generated
FROM
    public.agent_chat_sessions s
JOIN
    public.agents a ON s.agent_id = a.id
LEFT JOIN
    public.agent_chat_messages m ON s.id = m.session_id
LEFT JOIN
    public.orders o ON s.id = o.session_id
WHERE
    s.agent_id IS NOT NULL
GROUP BY
    1, 2, 3, 4, 5;
