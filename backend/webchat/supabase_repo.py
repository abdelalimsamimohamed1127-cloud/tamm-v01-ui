# backend/webchat/supabase_repo.py
import os
import uuid
from supabase import create_client, Client
from rest_framework import exceptions
from typing import Dict, Any, Optional

from core.errors import SupabaseUnavailableError

class WebchatSupabaseRepo:
    """
    Repository for all webchat-related Supabase operations.
    - Fetches agent data for validation.
    - Manages webchat_sessions table.
    - Inserts messages into agent_chat_messages.
    """
    def __init__(self, user_jwt: str = None):
        # The user JWT is used for requests on behalf of a logged-in user.
        # For public webchat, we might use the service role key for some operations.
        # This depends on RLS policies. For now, we allow a client to be created
        # with either user context or as an admin client.
        if user_jwt:
            self._client: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"), options={"headers": {"Authorization": f"Bearer {user_jwt}"}})
        else:
            # Fallback to service role for system-level operations if needed
            self._client: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

    def _get_table(self, table_name: str):
        return self._client.table(table_name)

    def get_agent_details(self, agent_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """
        Fetches agent details, including workspace_id, for validation.
        This ensures the agent exists and we can associate it with a workspace.
        """
        try:
            response = self._get_table("agents").select("id, workspace_id, ai_enabled").eq("id", str(agent_id)).single().execute()
            return response.data
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch agent details: {e}")

    def get_session(self, session_id: str, agent_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """
        Retrieves a session from the `webchat_sessions` table.
        """
        try:
            # Assumption: a `webchat_sessions` table exists.
            response = self._get_table("webchat_sessions").select("*").eq("id", session_id).eq("agent_id", str(agent_id)).single().execute()
            return response.data
        except Exception as e:
            # It's okay if a session is not found, so we don't raise a fatal error.
            print(f"Could not fetch session {session_id}: {e}")
            return None

    def create_session(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new session in the `webchat_sessions` table.
        """
        try:
            response = self._get_table("webchat_sessions").insert(session_data).select("*").single().execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to create webchat session.")
            return response.data
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to create webchat session: {e}")

    def create_chat_message(self, message_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Inserts a canonical message into the `agent_chat_messages` table.
        """
        try:
            response = self._get_table("agent_chat_messages").insert(message_data).select("id").single().execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to store webchat message.")
            return response.data
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to store webchat message: {e}")