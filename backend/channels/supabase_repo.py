import os
import uuid
from supabase import create_client, Client
from django.conf import settings
from rest_framework import exceptions
from typing import Dict, Any, Literal
from core.errors import SupabaseUnavailableError

class ChannelsSupabaseRepo:
    """
    Repository for interacting with Supabase for channel-related data.
    """
    def __init__(self, user_jwt: str = None):
        if user_jwt:
            self._client: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"), options={"headers": {"Authorization": f"Bearer {user_jwt}"}})
        else:
            self._client: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

    def _get_table(self, table_name: str):
        return self._client.table(table_name)

    def fetch_messenger_page_config(self, workspace_id: uuid.UUID, agent_id: uuid.UUID) -> Dict[str, Any]:
        """
        Fetches the Messenger page access token for an agent.
        """
        try:
            response = self._get_table("channel_configurations").select("config") \
                .eq("workspace_id", str(workspace_id)) \
                .eq("agent_id", str(agent_id)) \
                .eq("provider", "messenger") \
                .single().execute()
            if not response.data:
                raise exceptions.NotFound(f"Messenger configuration not found for agent {agent_id}")
            return response.data.get("config", {})
        except exceptions.NotFound:
            raise
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch Messenger page config: {e}")

    def fetch_instagram_config(self, workspace_id: uuid.UUID, agent_id: uuid.UUID) -> Dict[str, Any]:
        """
        Fetches the Instagram access token for an agent.
        """
        try:
            response = self._get_table("channel_configurations").select("config") \
                .eq("workspace_id", str(workspace_id)) \
                .eq("agent_id", str(agent_id)) \
                .eq("provider", "instagram") \
                .single().execute()
            if not response.data:
                raise exceptions.NotFound(f"Instagram configuration not found for agent {agent_id}")
            return response.data.get("config", {})
        except exceptions.NotFound:
            raise
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch Instagram config: {e}")

    def fetch_agent_channel_config(self, agent_id: uuid.UUID, workspace_id: uuid.UUID, channel: str) -> Dict[str, Any]:
        """
        Fetches specific channel configuration for an agent within a workspace.
        """
        try:
            response = self._get_table("agent_channels").select("config, agent_id, workspace_id, channel").eq("agent_id", str(agent_id)).eq("workspace_id", str(workspace_id)).eq("channel", channel).single().execute()
            if not response.data:
                raise exceptions.NotFound(f"Channel config for agent {agent_id} on channel {channel} not found or not accessible.")
            return response.data
        except exceptions.NotFound:
            raise
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch agent channel config: {e}")

    def update_conversation_status(self, conversation_id: uuid.UUID, status: Literal["ai_active", "needs_human", "human_active"]):
        """
        Updates the status of a conversation session.
        """
        try:
            response = self._get_table("chat_sessions").update({"status": status}).eq("id", str(conversation_id)).execute()
            if not response.data:
                raise SupabaseUnavailableError(f"Failed to update conversation {conversation_id} status to {status}.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to update conversation status: {e}")

    def fetch_agent_handoff_settings(self, agent_id: uuid.UUID, workspace_id: uuid.UUID) -> Dict[str, Any]:
        """
        Fetches agent settings relevant for handoff decisions.
        """
        try:
            response = self._get_table("agents").select("ai_enabled, handoff_mode").eq("id", str(agent_id)).eq("workspace_id", str(workspace_id)).single().execute()
            if not response.data:
                raise exceptions.NotFound(f"Agent {agent_id} not found or not accessible.")
            return response.data
        except exceptions.NotFound:
            raise
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch agent handoff settings: {e}")

    def create_outbound_message(self, message_data: Dict[str, Any]):
        """
        Stores an outbound message in Supabase before sending.
        """
        try:
            message_id = message_data.get("id", str(uuid.uuid4()))
            response = self._get_table("agent_chat_messages").insert({
                "id": message_id,
                "workspace_id": str(message_data["workspace_id"]),
                "agent_id": str(message_data["agent_id"]),
                "channel": message_data["channel"],
                "external_user_id": message_data["external_user_id"],
                "direction": "outbound",
                "message_type": message_data.get("message_type", "text"),
                "content": message_data["content"],
                "raw_payload": message_data.get("raw_payload", {{}})
            }).execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to store outbound message.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to store outbound message: {e}")