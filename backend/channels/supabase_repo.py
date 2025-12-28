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

    def get_agent_channel(self, agent_id: uuid.UUID, platform: str) -> Dict[str, Any]:
        """
        Fetches a single, specific channel configuration for an agent.
        """
        try:
            response = self._get_table("agent_channels").select("config") \
                .eq("agent_id", str(agent_id)) \
                .eq("platform", platform) \
                .single().execute()
            if not response.data:
                raise exceptions.NotFound(f"{platform} configuration not found for agent {agent_id}")
            return response.data
        except exceptions.NotFound:
            raise
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch {platform} config: {e}")

    def update_conversation_status(self, conversation_id: uuid.UUID, status: Literal["ai_active", "needs_human", "human_active"]):
        """
        Updates the status of a conversation session.
        """
        try:
            # Note: conversation status is on 'conversations' table, not 'chat_sessions'
            response = self._get_table("conversations").update({"status": status}).eq("id", str(conversation_id)).execute()
            if not response.data:
                raise SupabaseUnavailableError(f"Failed to update conversation {conversation_id} status to {status}.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to update conversation status: {e}")

    def update_conversation_last_message_info(self, conversation_id: uuid.UUID, last_message_content: str):
        """
        Updates the `last_message_at` and `summary` (with last message content)
        of a conversation in `public.conversations`.
        """
        try:
            response = self._get_table("conversations").update({
                "last_message_at": "now()",
                "summary": last_message_content
            }).eq("id", str(conversation_id)).execute()
            if not response.data:
                raise SupabaseUnavailableError(f"Failed to update last message info for conversation {conversation_id}.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to update conversation last message info: {e}")


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
        (NOTE: This method seems to use 'agent_chat_messages',
        but `insert_chat_message` below will use 'chat_messages' for general chat history.
        The correct table should be determined by overall schema design).
        For now, `insert_chat_message` is the one to use for Inbox messages.
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
                "raw_payload": message_data.get("raw_payload", {})
            }).execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to store outbound message.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to store outbound message: {e}")

    def insert_chat_message(self, session_id: uuid.UUID, role: str, content: str, tokens_used: int | None = None) -> uuid.UUID:
        """
        Inserts a message into public.chat_messages.
        """
        try:
            message_id = uuid.uuid4()
            message_data = {
                "id": str(message_id),
                "session_id": str(session_id),
                "role": role,
                "content": content
            }
            if tokens_used is not None:
                message_data["token_count"] = tokens_used

            response = self._get_table("chat_messages").insert(message_data).execute()
            
            if response.data:
                return message_id
            else:
                raise SupabaseUnavailableError(f"Failed to insert {role} message for session {session_id}.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to insert {role} message for session {session_id}: {e}")

    def get_conversation(self, conversation_id: uuid.UUID) -> Dict[str, Any] | None:
        """
        Fetches a single conversation by its ID from public.conversations.
        """
        try:
            response = self._get_table("conversations").select("*").eq("id", str(conversation_id)).single().execute()
            return response.data
        except Exception as e:
            # If conversation not found, data will be None, no need to raise if it's expected
            # just return None or let caller handle it.
            if "PGRST" in str(e) and "rows not found" in str(e): # Specific Supabase error for no rows
                 return None
            raise SupabaseUnavailableError(detail=f"Failed to fetch conversation {conversation_id}: {e}")