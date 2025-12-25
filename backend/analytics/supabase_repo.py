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


class MessageEnrichmentSupabaseRepo:
    """
    Dedicated repository for persisting message enrichment data.
    Separated from AnalyticsSupabaseRepo to maintain "analytics reads only" rule for the latter.
    """
    def __init__(self, user_jwt: str):
        self._client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY, options={"headers": {"Authorization": f"Bearer {user_jwt}"}})

    def persist_message_enrichment(self, enrichment_data: Dict[str, Any]):
        """
        Persists message enrichment data to the analytics_message_enrichment table.
        """
        try:
            response = self._client.table("analytics_message_enrichment").insert({
                "id": str(uuid.uuid4()),
                "message_id": str(enrichment_data["message_id"]),
                "workspace_id": str(enrichment_data["workspace_id"]),
                "agent_id": str(enrichment_data.get("agent_id")),
                "topic": enrichment_data.get("topic"),
                "intent": enrichment_data.get("intent"),
                "sentiment": enrichment_data.get("sentiment"),
                "entities": enrichment_data.get("entities", {}),
            }).execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to persist message enrichment data.")
        except Exception as e:
            raise SupabaseUnavailableError(f"Failed to persist message enrichment data: {e}")