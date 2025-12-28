import logging
import uuid
import datetime
import json
from typing import Dict, Any, List, Optional
import os

from supabase import create_client, Client
from django.conf import settings # Assuming Django settings are accessible

# NOTE: This file should import `analytics_repo` from `backend.analytics.supabase_repo`
# which is not explicitly defined in the problem description, but a common pattern.
# For now, we will create a direct Supabase client.
# In a real scenario, this would be a dedicated repository.

logger = logging.getLogger(__name__)

class InsightsEngine: # Renamed from InsightGenerator
    """
    Generates and stores insights from analytics data.
    """
    _client: Client

    def __init__(self, workspace_id: uuid.UUID, user_jwt: str):
        self.workspace_id = workspace_id
        self.user_jwt = user_jwt
        self.analytics_repo = AnalyticsSupabaseRepo(user_jwt) # Use the existing repo
        
        # Original Supabase client (only for direct table access for insights storage/check)
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY") # Or service key if available
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set.")
        self._client = create_client(supabase_url, supabase_key)

    def _get_table(self, table_name: str):
        return self._client.table(table_name)

    def _query_daily_stats(self, period_start: datetime.date, period_end: datetime.date) -> List[Dict]:
        """ Fetches daily_stats for the period. """
        response = self._get_table("daily_stats").select("*") \
            .eq("workspace_id", str(self.workspace_id)) \
            .gte("date", period_start.isoformat()) \
            .lte("date", period_end.isoformat()) \
            .order("date", { "ascending": True }) \
            .execute()
        return response.data if response.data else []

    def _query_usage_events(self, period_start: datetime.date, period_end: datetime.date) -> List[Dict]:
        """ Fetches usage_events for the period. """
        response = self._get_table("usage_events").select("event_type, quantity") \
            .eq("workspace_id", str(self.workspace_id)) \
            .gte("created_at", period_start.isoformat()) \
            .lte("created_at", period_end.isoformat()) \
            .execute()
        return response.data if response.data else []

    def _insight_exists(self, insight_type: str, period_start: datetime.date, period_end: datetime.date) -> bool:
        """ Checks if an insight for the given type and period already exists. """
        response = self._get_table("analytics_insights").select("id") \
            .eq("workspace_id", str(self.workspace_id)) \
            .eq("insight_type", insight_type) \
            .eq("period_start", period_start.isoformat()) \
            .eq("period_end", period_end.isoformat()) \
            .limit(1) \
            .execute()
        return bool(response.data)

    def _store_insight(self, insight_type: str, title: str, summary: str,
                       payload: Dict, period_start: datetime.date, period_end: datetime.date):
        """ Stores a generated insight. """
        insight_data = {
            "id": str(uuid.uuid4()),
            "workspace_id": str(self.workspace_id),
            "period_start": period_start.isoformat(), # Store as ISO format for Supabase date type
            "period_end": period_end.isoformat(),     # Store as ISO format for Supabase date type
            "insight_type": insight_type,
            "title": title,
            "summary": summary,
            "payload": json.dumps(payload), # Ensure payload is stored as JSON string
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        response = self._get_table("analytics_insights").insert(insight_data).execute()
        if not response.data:
            logger.error(f"Failed to store insight: {insight_type} for workspace {self.workspace_id}")
        return response.data

    def _generate_conversation_volume_trend(self, daily_stats: List[Dict], period_start: datetime.date, period_end: datetime.date):
        insight_type = "conversation_volume_trend"
        if self._insight_exists(insight_type, period_start, period_end): return
        
        if not daily_stats: return

        first_day_conv = daily_stats[0].get("conversations_count", 0)
        last_day_conv = daily_stats[-1].get("conversations_count", 0)
        total_conv = sum(s.get("conversations_count", 0) for s in daily_stats)

        trend = "stable"
        percentage_change = 0
        if first_day_conv > 0:
            percentage_change = ((last_day_conv - first_day_conv) / first_day_conv) * 100
            if percentage_change > 10: trend = "increased significantly"
            elif percentage_change < -10: trend = "decreased significantly"
            elif percentage_change > 0: trend = "increased slightly"
            elif percentage_change < 0: trend = "decreased slightly"
        
        title = f"Conversation Volume Trend: {trend.capitalize()}"
        summary = f"Total conversations for the period: {total_conv}. {trend.capitalize()} by {percentage_change:.2f}% from {first_day_conv} to {last_day_conv}."
        payload = {
            "total_conversations": total_conv,
            "percentage_change": percentage_change,
            "trend": trend,
            "daily_data": [{"date": s["date"], "conversations_count": s.get("conversations_count", 0)} for s in daily_stats]
        }
        self._store_insight(insight_type, title, summary, payload, period_start, period_end)

    def _generate_top_agent_channel_usage(self, daily_stats: List[Dict], period_start: datetime.date, period_end: datetime.date):
        insight_type = "top_agent_channel_usage"
        if self._insight_exists(insight_type, period_start, period_end): return

        top_agents = []
        top_channels = []

        try:
            agent_breakdown = self.analytics_repo.get_breakdown_data(
                workspace_id=self.workspace_id,
                start_date=period_start,
                end_date=period_end,
                breakdown_by="agent"
            )
            if agent_breakdown:
                # Assuming agent_breakdown contains 'agent_id' and a metric like 'total_messages'
                sorted_agents = sorted(agent_breakdown, key=lambda x: x.get("total_messages", 0), reverse=True)
                top_agents = sorted_agents[:3] # Get top 3 agents
        except Exception as e:
            logger.warning(f"Could not fetch agent breakdown data: {e}")

        try:
            channel_breakdown = self.analytics_repo.get_breakdown_data(
                workspace_id=self.workspace_id,
                start_date=period_start,
                end_date=period_end,
                breakdown_by="channel"
            )
            if channel_breakdown:
                # Assuming channel_breakdown contains 'channel' and 'total_messages'
                sorted_channels = sorted(channel_breakdown, key=lambda x: x.get("total_messages", 0), reverse=True)
                top_channels = sorted_channels[:3] # Get top 3 channels
        except Exception as e:
            logger.warning(f"Could not fetch channel breakdown data: {e}")

        if not top_agents and not top_channels:
            logger.info("No agent or channel breakdown data to generate insight.")
            return
        
        title = "Top Agent & Channel Usage"
        summary_parts = []
        payload_data = {}

        if top_agents:
            agent_summaries = [f"{a.get('agent_name', 'Unknown Agent')} ({a.get('total_messages', 0)} messages)" for a in top_agents]
            summary_parts.append(f"Top Agents: {'; '.join(agent_summaries)}")
            payload_data["top_agents"] = top_agents
        
        if top_channels:
            channel_summaries = [f"{c.get('channel', 'Unknown Channel')} ({c.get('total_messages', 0)} messages)" for c in top_channels]
            summary_parts.append(f"Top Channels: {'; '.join(channel_summaries)}")
            payload_data["top_channels"] = top_channels
        
        summary = ". ".join(summary_parts) if summary_parts else "No significant agent or channel usage detected for the period."

        self._store_insight(insight_type, title, summary, payload_data, period_start, period_end)


    def _generate_message_to_order_conversion(self, daily_stats: List[Dict], period_start: datetime.date, period_end: datetime.date):
        insight_type = "message_to_order_conversion"
        if self._insight_exists(insight_type, period_start, period_end): return

        if not daily_stats: return

        total_messages = sum(s.get("messages_count", 0) for s in daily_stats)
        total_orders = sum(s.get("orders_count", 0) for s in daily_stats)
        
        conversion_rate = (total_orders / total_messages * 100) if total_messages > 0 else 0
        
        title = "Message to Order Conversion"
        summary = f"Conversion Rate: {conversion_rate:.2f}% ({total_orders} orders from {total_messages} messages)."
        payload = {
            "total_messages": total_messages,
            "total_orders": total_orders,
            "conversion_rate": conversion_rate,
        }
        self._store_insight(insight_type, title, summary, payload, period_start, period_end)

    def _generate_usage_spike_detection(self, usage_events: List[Dict], period_start: datetime.date, period_end: datetime.date):
        insight_type = "usage_spike_detection"
        if self._insight_exists(insight_type, period_start, period_end): return

        if not usage_events: return

        # Basic spike detection: find days with significantly higher usage than average
        daily_usage = {}
        for event in usage_events:
            event_date = datetime.datetime.fromisoformat(event["created_at"].replace('Z', '+00:00')).date()
            if period_start <= event_date <= period_end:
                date_str = event_date.isoformat()
                daily_usage[date_str] = daily_usage.get(date_str, 0) + event.get("quantity", 0)

        usage_values = list(daily_usage.values())
        if not usage_values: return

        average_usage = sum(usage_values) / len(usage_values)
        spike_days = []
        for date_str, quantity in daily_usage.items():
            if quantity > average_usage * 1.5: # 50% above average
                spike_days.append({"date": date_str, "quantity": quantity})
        
        if spike_days:
            title = "Usage Spike Detected"
            summary = f"Spikes detected on {len(spike_days)} days with usage significantly above average ({average_usage:.2f})."
            payload = {
                "average_usage": average_usage,
                "spike_days": spike_days,
                "daily_usage": daily_usage
            }
            self._store_insight(insight_type, title, summary, payload, period_start, period_end)
        else:
            logger.info("No significant usage spikes detected.")


    def generate_structured_insights(self, period_start: datetime.date, period_end: datetime.date): # Renamed from generate_insights
        """ Orchestrates the generation of all insights for a given period. """
        logger.info(
            f"Starting structured insight generation for workspace {self.workspace_id} from {period_start} to {period_end}"
        )

        daily_stats = self._query_daily_stats(period_start, period_end)
        usage_events = self._query_usage_events(period_start, period_end)

        self._generate_conversation_volume_trend(daily_stats, period_start, period_end)
        self._generate_top_agent_channel_usage(daily_stats, period_start, period_end)
        self._generate_message_to_order_conversion(daily_stats, period_start, period_end)
        self._generate_usage_spike_detection(usage_events, period_start, period_end)

        logger.info(
            f"Finished structured insight generation for workspace {self.workspace_id} from {period_start} to {period_end}"
        )
    
    def generate_insight(self, question: str, context: Dict[str, Any], agent_id: Optional[uuid.UUID] = None) -> Dict[str, Any]:
        """
        Placeholder for AI-powered insight generation.
        This would typically involve calling an LLM or an AI model.
        """
        logger.warning(
            f"AI-powered insight generation not yet fully implemented. Question: '{question}' for workspace {self.workspace_id}"
        )
        return {
            "insight_type": "ai_powered_summary",
            "title": f"AI Insight for '{question}'",
            "summary": "This is a placeholder for an AI-generated insight based on your question.",
            "payload": {
                "question": question,
                "context": context,
                "agent_id": str(agent_id) if agent_id else None
            }
        }
