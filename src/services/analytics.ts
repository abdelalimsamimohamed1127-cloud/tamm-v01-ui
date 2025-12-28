import { supabase } from '@/lib/supabase';
import { Insight } from '../types/analytics'; // Import the new Insight type

// --- TYPE DEFINITIONS ---
// Aligned with the actual database views

export interface DailyStat {
  date: string;
  conversations_count: number;
  messages_count: number;
  orders_count: number;
  revenue_total: number;
}

export interface AgentPerformance {
  agent_id: string;
  agent_name: string;
  agent_model: string;
  sessions_count: number;
  total_messages: number;
  revenue_generated: number;
}

export interface ChannelActivity {
  channel_platform: string;
  conversation_count: number;
  message_count: number;
}

export interface DailyUsage {
    date: string;
    quantity: number;
}


// --- SERVICE FUNCTIONS ---

/**
 * Fetches aggregated daily stats for the main KPIs.
 */
export const getDailyStats = async (workspaceId: string, startDate: string) => {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('date, conversations_count, messages_count, orders_count, revenue_total')
    .eq('workspace_id', workspaceId)
    .gte('date', startDate)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching daily stats:', error);
    throw error;
  }
  return data as DailyStat[];
};

/**
 * Fetches aggregated performance metrics per agent.
 */
export const getAgentPerformance = async (workspaceId: string, startDate: string) => {
    const { data, error } = await supabase
        .from('agent_daily_performance')
        .select('agent_id, agent_name, agent_model, sessions_count, total_messages, revenue_generated')
        .eq('workspace_id', workspaceId)
        .gte('activity_date', startDate);

    if (error) {
        console.error('Error fetching agent performance:', error);
        throw error;
    }

    // Manual aggregation client-side
    const agentMap = new Map<string, AgentPerformance>();
    if (data) {
      data.forEach(row => {
          const agent = agentMap.get(row.agent_id);
          if (agent) {
              agent.sessions_count += row.sessions_count;
              agent.total_messages += row.total_messages;
              agent.revenue_generated += row.revenue_generated;
          } else {
              agentMap.set(row.agent_id, { ...row });
          }
      });
    }

    return Array.from(agentMap.values()).sort((a,b) => b.total_messages - a.total_messages);
};

/**
 * Fetches aggregated message and conversation counts per channel.
 */
export const getChannelActivity = async (workspaceId: string, startDate: string) => {
    const { data, error } = await supabase
        .from('channel_daily_activity')
        .select('channel_platform, conversation_count, message_count')
        .eq('workspace_id', workspaceId)
        .gte('activity_date', startDate);
    
    if (error) {
        console.error('Error fetching channel activity:', error);
        throw error;
    }

    // Manual aggregation client-side
    const channelMap = new Map<string, ChannelActivity>();
    if (data) {
      data.forEach(row => {
          const channel = channelMap.get(row.channel_platform);
          if (channel) {
              channel.conversation_count += row.conversation_count;
              channel.message_count += row.message_count;
          } else {
              channelMap.set(row.channel_platform, { ...row });
          }
      });
    }
    
    return Array.from(channelMap.values());
};


/**
 * Fetches daily usage event quantity, aggregated by day.
 */
export const getUsageEvents = async (workspaceId: string, startDate: string) => {
    const { data, error } = await supabase
        .from('usage_events')
        .select('created_at, quantity')
        .eq('workspace_id', workspaceId)
        .gte('created_at', startDate);
    
    if (error) {
        console.error('Error fetching usage events:', error);
        throw error;
    }

    // Manual aggregation client-side
    const usageMap = new Map<string, number>();
    if (data) {
      data.forEach(row => {
          const date = row.created_at.split('T')[0];
          usageMap.set(date, (usageMap.get(date) || 0) + row.quantity);
      });
    }

    return Array.from(usageMap.entries()).map(([date, quantity]) => ({ date, quantity }));
};

/**
 * Fetches total usage event quantity.
 */
export const getTotalUsage = async (workspaceId: string, startDate: string) => {
    const { data, error } = await supabase
        .from('usage_events')
        .select('quantity')
        .eq('workspace_id', workspaceId)
        .gte('created_at', startDate);

    if (error) {
        console.error('Error fetching total usage:', error);
        throw error;
    }
    
    return data.reduce((acc, row) => acc + row.quantity, 0);
}

// --- INSIGHTS GENERATION & FETCHING ---

/**
 * Triggers the backend job to generate structured insights for a given period.
 */
export const triggerStructuredInsightGeneration = async (
  workspaceId: string,
  periodStart: string, // YYYY-MM-DD
  periodEnd: string    // YYYY-MM-DD
) => {
  const response = await fetch('/api/v1/analytics/insights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabase.auth.session()?.access_token}`, // Use current user's JWT
    },
    body: JSON.stringify({
      period_start: periodStart,
      period_end: periodEnd,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to trigger insight generation.');
  }

  return response.json();
};

/**
 * Fetches stored insights for a workspace, with optional filters.
 */
interface GetInsightsFilters {
  periodStart?: string;
  periodEnd?: string;
  insightType?: string;
}

export const getStoredInsights = async (
  workspaceId: string,
  filters?: GetInsightsFilters
): Promise<Insight[]> => {
  let query = supabase
    .from('analytics_insights')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (filters?.periodStart) {
    query = query.gte('period_start', filters.periodStart);
  }
  if (filters?.periodEnd) {
    query = query.lte('period_end', filters.periodEnd);
  }
  if (filters?.insightType) {
    query = query.eq('insight_type', filters.insightType);
  }

  const { data, error } = await query.execute();

  if (error) {
    console.error('Error fetching stored insights:', error);
    throw new Error(error.message);
  }

  return data as Insight[];
};

export const getChatSessionSummaries = async (workspaceId: string, from: string, to: string) => {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select(
      "id, topic, sentiment, urgency, channel, channel_id, created_at, external_user_id, user_id, session_id",
    )
    .eq("workspace_id", workspaceId)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: false });

  if (error) {
    console.error('Error fetching chat session summaries:', error);
    throw error;
  }
  return data;
};
