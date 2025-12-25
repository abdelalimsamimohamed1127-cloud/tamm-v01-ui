import os
import uuid
from supabase import create_client, Client
from django.conf import settings
from rest_framework import exceptions
from core.errors import SupabaseUnavailableError

# --- Supabase Client Initialization ---
# Assuming these are set in the environment or Django settings
SUPABASE_URL = os.getenv("SUPABASE_URL", settings.SUPABASE_URL)
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", settings.SUPABASE_ANON_KEY)

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise exceptions.ImproperlyConfigured(
        "SUPABASE_URL and SUPABASE_ANON_KEY must be configured in environment variables or Django settings."
    )

# Global Supabase client (used for system-level operations if needed, or initial connection)
# For user-scoped data, a client with the user's JWT will be created dynamically.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# --- Service Layer for Supabase Interactions ---
class SupabaseRepo:
    """
    Repository for interacting with Supabase, abstracting all DB operations.
    All methods here should accept a 'user_jwt' to create a client with
    the user's RLS-enabled session for user-scoped data access.
    """
    def __init__(self, user_jwt: str):
        if not user_jwt:
            raise ValueError("user_jwt is required for SupabaseRepo to enforce RLS.")
        # Create a Supabase client with the user's JWT to enforce Row Level Security
        self._client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY, options={"headers": {"Authorization": f"Bearer {user_jwt}"}})

    def _get_table(self, table_name: str):
        return self._client.table(table_name)

    def fetch_agent_config(self, agent_id: uuid.UUID, workspace_id: uuid.UUID, mode: str) -> dict:
        """
        Fetches the agent configuration from Supabase.
        """
        try:
            response = self._get_table("agents").select("config").eq("id", str(agent_id)).eq("workspace_id", str(workspace_id)).single().execute()

            if not response.data:
                raise exceptions.NotFound(f"Agent with ID {agent_id} not found or not accessible in workspace {workspace_id}.")
            
            agent_config = response.data.get("config", {})
            return agent_config
        except Exception as e:
            # Log the exception e
            raise SupabaseUnavailableError(detail=f"Failed to fetch agent configuration: {e}")


    def create_chat_session(self, workspace_id: uuid.UUID, agent_id: uuid.UUID, channel: str) -> uuid.UUID:
        """
        Creates a new chat session in Supabase.
        """
        try:
            session_id = uuid.uuid4()
            response = self._get_table("chat_sessions").insert({
                "id": str(session_id),
                "workspace_id": str(workspace_id),
                "agent_id": str(agent_id),
                "channel": channel
            }).execute()

            if response.data:
                return session_id
            else:
                raise SupabaseUnavailableError("Failed to create chat session.")
        except Exception as e:
            # Log the exception e
            raise SupabaseUnavailableError(detail=f"Failed to create chat session: {e}")

    def persist_message(self, session_id: uuid.UUID, role: str, content: str) -> uuid.UUID:
        """
        Persists a single message (user or assistant) to Supabase.
        """
        try:
            message_id = uuid.uuid4()
            response = self._get_table("chat_messages").insert({
                "id": str(message_id),
                "session_id": str(session_id),
                "role": role,
                "content": content
            }).execute()
            
            if response.data:
                return message_id
            else:
                raise SupabaseUnavailableError(f"Failed to persist {role} message for session {session_id}.")
        except Exception as e:
            # Log the exception e
            raise SupabaseUnavailableError(detail=f"Failed to persist {role} message for session {session_id}: {e}")

