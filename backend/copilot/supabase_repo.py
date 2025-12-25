import os
import uuid
from supabase import create_client, Client
from django.conf import settings
from rest_framework import exceptions
from typing import Dict, Any, List
import datetime

from core.errors import SupabaseUnavailableError

class CopilotSupabaseRepo:
    """
    Repository for reading analytics data from Supabase views for the Copilot.
    """
    def __init__(self, user_jwt: str):
        self._client: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"),
                                            options={"headers": {"Authorization": f"Bearer {user_jwt}"}})

    def _get_view(self, view_name: str):
        return self._client.from_(view_name)

    def get_overview_metrics(self, workspace_id: uuid.UUID, start_date: datetime.date, end_date: datetime.date, agent_id: uuid.UUID = None, channel: str = None) -> Dict[str, Any]:
        """
        Fetches overview metrics from a Supabase analytics view.
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
            raise SupabaseUnavailableError(detail=f"Failed to fetch overview metrics for Copilot: {e}")

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
            raise SupabaseUnavailableError(detail=f"Failed to fetch sentiment summary for Copilot: {e}")

    def get_timeseries_data(self, workspace_id: uuid.UUID, start_date: datetime.date, end_date: datetime.date, agent_id: uuid.UUID = None, channel: str = None) -> List[Dict[str, Any]]:
        """
        Fetches time-series analytics data from a Supabase view.
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
            raise SupabaseUnavailableError(detail=f"Failed to fetch time-series data for Copilot: {e}")

    def get_breakdown_data(self, workspace_id: uuid.UUID, start_date: datetime.date, end_date: datetime.date, breakdown_by: str, agent_id: uuid.UUID = None, channel: str = None) -> List[Dict[str, Any]]:
        """
        Fetches breakdown data from a Supabase view.
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
            raise SupabaseUnavailableError(detail=f"Failed to fetch breakdown data for Copilot: {e}")
    
    def _get_avg_response_time(self, data: List[Dict]) -> float:
        """Helper to calculate average response time from daily summary data."""
        # This is a simplified calculation. Real avg response time would be in the view.
        total_response_time_sum = sum(row.get("avg_response_time_sum", 0) for row in data)
        total_messages_with_response = sum(row.get("total_messages_with_response", 0) for row in data) # Assuming this column
        return round(total_response_time_sum / total_messages_with_response, 2) if total_messages_with_response > 0 else 0

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
                "context": insight_data.get("context", {}),
            }).execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to store insight.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to store Copilot insight in Supabase: {e}")
