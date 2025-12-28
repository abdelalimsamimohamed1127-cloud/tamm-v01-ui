import os
import uuid
from supabase import create_client, Client
from django.conf import settings
from rest_framework import exceptions
from typing import Dict, Any, List
import datetime
from core.errors import SupabaseUnavailableError

# --- Supabase Client Initialization ---
SUPABASE_URL = os.getenv("SUPABASE_URL", settings.SUPABASE_URL)
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", settings.SUPABASE_ANON_KEY)

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise exceptions.ImproperlyConfigured(
        "SUPABASE_URL and SUPABASE_ANON_KEY must be configured in environment variables or Django settings."
    )

class AnalyticsSupabaseRepo:
    """
    Repository for reading analytics data from Supabase views.
    Enforces RLS via user's JWT. Django only reads; Supabase computes aggregates.
    """
    def __init__(self, user_jwt: str):
        self._client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY, options={"headers": {"Authorization": f"Bearer {user_jwt}"}})

    def _get_view(self, view_name: str):
        return self._client.from_(view_name) # Use .from_() for views/functions

    def get_overview_metrics(self, workspace_id: uuid.UUID, start_date: datetime.date, end_date: datetime.date, agent_id: uuid.UUID = None, channel: str = None) -> Dict[str, Any]:
        """
        Fetches overview metrics from a Supabase analytics view (e.g., analytics_daily_summary).
        """
        try:
            query = self._get_view("analytics_daily_summary").select("*") \
                        .eq("workspace_id", str(workspace_id)) \
                        .gte("date", str(start_date)) \
                        .lte("date", str(end_date))
            
            if agent_id:
                query = query.eq("agent_id", str(agent_id))
            if channel:
                query = query.eq("channel", channel)
            
            response = query.execute()
            if response.data:
                # Aggregate data from view results (minimal aggregation in Django)
                total_messages = sum(row.get("total_messages", 0) for row in response.data)
                total_ai_responses = sum(row.get("ai_responses", 0) for row in response.data)
                ai_response_rate = total_ai_responses / total_messages if total_messages > 0 else 0
                
                sentiment_summary = self.get_sentiment_summary(workspace_id, start_date, end_date, agent_id, channel)
                
                return {
                    "total_messages": total_messages,
                    "ai_response_rate": round(ai_response_rate, 2),
                    "avg_response_time": self._get_avg_response_time(response.data),
                    "sentiment": sentiment_summary,
                }
            return {
                "total_messages": 0,
                "ai_response_rate": 0,
                "avg_response_time": 0,
                "sentiment": {"positive": 0, "neutral": 0, "negative": 0},
            }
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch overview metrics from Supabase: {e}")

    def get_sentiment_summary(self, workspace_id: uuid.UUID, start_date: datetime.date, end_date: datetime.date, agent_id: uuid.UUID = None, channel: str = None) -> Dict[str, int]:
        """
        Fetches message sentiment summary from analytics_message_sentiment view.
        """
        try:
            query = self._get_view("analytics_message_sentiment").select("*") \
                        .eq("workspace_id", str(workspace_id)) \
                        .gte("date", str(start_date)) \
                        .lte("date", str(end_date))
            
            if agent_id:
                query = query.eq("agent_id", str(agent_id))
            if channel:
                query = query.eq("channel", channel)
            
            response = query.execute()
            
            sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
            if response.data:
                for row in response.data:
                    sentiment_counts["positive"] += row.get("positive_count", 0)
                    sentiment_counts["neutral"] += row.get("neutral_count", 0)
                    sentiment_counts["negative"] += row.get("negative_count", 0)
            return sentiment_counts
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch sentiment summary from Supabase: {e}")

    def get_timeseries_data(self, workspace_id: uuid.UUID, start_date: datetime.date, end_date: datetime.date, agent_id: uuid.UUID = None, channel: str = None) -> List[Dict[str, Any]]:
        """
        Fetches time-series analytics data (e.g., daily message counts) from a Supabase view.
        """
        try:
            query = self._get_view("analytics_daily_summary").select("date, total_messages, ai_responses") \
                        .eq("workspace_id", str(workspace_id)) \
                        .gte("date", str(start_date)) \
                        .lte("date", str(end_date))
            
            if agent_id:
                query = query.eq("agent_id", str(agent_id))
            if channel:
                query = query.eq("channel", channel)
            
            response = query.order("date.asc").execute()
            return response.data if response.data else []
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch time-series data from Supabase: {e}")

    def get_breakdown_data(self, workspace_id: uuid.UUID, start_date: datetime.date, end_date: datetime.date, breakdown_by: str, agent_id: uuid.UUID = None, channel: str = None) -> List[Dict[str, Any]]:
        """
        Fetches breakdown data (e.g., by agent, by channel, by topic) from a Supabase view.
        """
        try:
            view_map = {
                "agent": "analytics_agent_performance",
                "channel": "analytics_channel_usage",
                "topic": "analytics_message_topic_breakdown",
            }
            view_name = view_map.get(breakdown_by)
            if not view_name:
                raise exceptions.ValidationError(f"Invalid breakdown_by parameter: {breakdown_by}")

            query = self._get_view(view_name).select("*") \
                        .eq("workspace_id", str(workspace_id)) \
                        .gte("date", str(start_date)) \
                        .lte("date", str(end_date))
            
            if agent_id and breakdown_by != "agent":
                query = query.eq("agent_id", str(agent_id))
            if channel and breakdown_by != "channel":
                query = query.eq("channel", channel)
            
            response = query.execute()
            return response.data if response.data else []
        except exceptions.ValidationError:
            raise
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch breakdown data from Supabase: {e}")
    
    def _get_avg_response_time(self, data: List[Dict]) -> float:
        """Helper to calculate average response time from daily summary data."""
        total_time = sum(row.get("avg_response_time_sum", 0) * row.get("total_messages", 0) for row in data)
        total_msgs = sum(row.get("total_messages", 0) for row in data)
        return round(total_time / total_msgs, 2) if total_msgs > 0 else 0

    def get_insights(self, workspace_id: uuid.UUID, start_date: datetime.date = None, end_date: datetime.date = None, insight_type: str = None) -> List[Dict[str, Any]]:
        """
        Fetches insights from the analytics_insights table.
        """
        try:
            query = self._client.from_("analytics_insights").select("*") \
                        .eq("workspace_id", str(workspace_id))
            
            if start_date:
                query = query.gte("period_start", str(start_date))
            if end_date:
                query = query.lte("period_end", str(end_date))
            if insight_type:
                query = query.eq("insight_type", insight_type)
            
            response = query.order("created_at.desc").execute()
            return response.data if response.data else []
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch insights from Supabase: {e}")

    def store_insight(self, insight_data: Dict[str, Any]):
        """
        Stores a generated insight in the analytics_insights table.
        """
        try:
            response = self._client.table("analytics_insights").insert({
                "id": str(uuid.uuid4()),
                "workspace_id": str(insight_data["workspace_id"]),
                "agent_id": str(insight_data.get("agent_id")),
                "summary_text": insight_data["summary_text"],
            }).execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to store insight.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to store insight in Supabase: {e}")
    
    def update_conversation_enrichment(self, conversation_id: uuid.UUID, sentiment: str, topic: str, urgency: str):
        """
        Updates the sentiment, topic, and urgency fields of a conversation in public.conversations.
        """
        try:
            response = self._client.table("conversations").update({
                "sentiment_score": sentiment, # Assuming direct string mapping for now, or convert to int2
                "primary_topic": topic,
                "urgency": urgency,
            }).eq("id", str(conversation_id)).execute()
            if not response.data:
                raise SupabaseUnavailableError(f"Failed to update enrichment for conversation {conversation_id}.")
        except Exception as e:
            raise SupabaseUnavailableError(f"Failed to update conversation enrichment: {e}")