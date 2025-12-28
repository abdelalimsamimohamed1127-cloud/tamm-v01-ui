import os
import uuid
from supabase import create_client, Client
from django.conf import settings
from rest_framework import exceptions
from core.errors import SupabaseUnavailableError
import logging # ADDED

logger = logging.getLogger(__name__) # ADDED

# --- Supabase Client Initialization ---
# Assuming these are set in the environment or Django settings
SUPABASE_URL = os.getenv("SUPABASE_URL", settings.SUPABASE_URL)
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", settings.ANON_KEY) # Corrected to settings.ANON_KEY

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

    def get_base_agent_config(self, agent_id: uuid.UUID, workspace_id: uuid.UUID) -> dict:
        """
        Fetches the base agent configuration and version pointers from the 'agents' table.
        """
        try:
            agent_data_response = self._get_table("agents").select("id, system_prompt, rules_jsonb, draft_version_id, published_version_id").eq("id", str(agent_id)).eq("workspace_id", str(workspace_id)).single().execute()

            if not agent_data_response.data:
                raise exceptions.NotFound(f"Agent with ID {agent_id} not found or not accessible in workspace {workspace_id}.")

            return agent_data_response.data
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch base agent config: {e}")

    def get_agent_version_config(self, version_id: uuid.UUID) -> dict:
        """
        Fetches a specific agent version's configuration from the 'agent_versions' table.
        """
        try:
            version_data_response = self._get_table("agent_versions").select("system_prompt, rules_jsonb").eq("id", str(version_id)).single().execute()

            if not version_data_response.data:
                raise exceptions.NotFound(f"Agent version with ID {version_id} not found.")

            return version_data_response.data
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch agent version config: {e}")


    def create_chat_session(self, workspace_id: uuid.UUID, agent_id: uuid.UUID, channel: str, session_id: uuid.UUID | None = None) -> uuid.UUID:
        """
        Creates a new chat session in Supabase.
        If session_id is provided, it uses that ID; otherwise, it generates a new one.
        """
        try:
            if session_id is None:
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

    def check_session_exists(self, session_id: uuid.UUID) -> bool:
        """
        Checks if a chat session with the given ID exists.
        """
        try:
            response = self._get_table("chat_sessions").select("id").eq("id", str(session_id)).limit(1).execute()
            return bool(response.data)
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to check if session {session_id} exists: {e}")

    def insert_message(self, session_id: uuid.UUID, role: str, content: str, tokens_used: int | None = None) -> uuid.UUID:
        """
        Inserts a single message (user or assistant) to Supabase.
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
                message_data["tokens_used"] = tokens_used

            response = self._get_table("agent_chat_messages").insert(message_data).execute() # Changed table name to agent_chat_messages

            if response.data:
                return message_id
            else:
                raise SupabaseUnavailableError(f"Failed to insert {role} message for session {session_id}.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to insert {role} message for session {session_id}: {e}")

    def insert_user_message(self, session_id: uuid.UUID, content: str) -> uuid.UUID:
        """
        Inserts a user message into Supabase.
        """
        return self.insert_message(session_id, "user", content)

    def insert_ai_message(self, session_id: uuid.UUID, content: str, tokens_used: int | None = None) -> uuid.UUID:
        """
        Inserts an AI message into Supabase.
        """
        return self.insert_message(session_id, "assistant", content, tokens_used)

    def log_usage_event(self, workspace_id: uuid.UUID, event_type: str, credits_used: int | None = None, agent_id: uuid.UUID | None = None, channel: str | None = None, details: dict | None = None, model: str | None = None, input_tokens: int | None = None, output_tokens: int | None = None, cost_usd: float | None = None):
        """
        Logs a usage event to the 'usage_events' table.
        """
        try:
            event_data = {
                "workspace_id": str(workspace_id),
                "event_type": event_type,
            }
            if credits_used is not None:
                event_data["credits_used"] = credits_used
            if agent_id:
                event_data["agent_id"] = str(agent_id)
            if channel:
                event_data["channel"] = channel
            if details:
                event_data["details"] = details
            if model:
                event_data["model"] = model
            if input_tokens is not None:
                event_data["input_tokens"] = input_tokens
            if output_tokens is not None:
                event_data["output_tokens"] = output_tokens
            if cost_usd is not None:
                event_data["cost_usd"] = cost_usd

            self._get_table("usage_events").insert(event_data).execute()
        except Exception as e:
            logger.error(f"Failed to log usage event for workspace {workspace_id} (type: {event_type}): {e}", exc_info=True)
            # Do not re-raise as usage logging should not block core functionality.

    def create_draft_version(self, agent_id: uuid.UUID, system_prompt: str, rules_jsonb: dict, created_by: uuid.UUID) -> uuid.UUID:
        """
        Creates a new draft version for an agent and updates the agent's draft_version_id.
        """
        try:
            # Determine the next version number
            latest_version_response = self._get_table("agent_versions").select("version_number").eq("agent_id", str(agent_id)).order("version_number", ascending=False).limit(1).execute()
            latest_version_number = latest_version_response.data[0]["version_number"] if latest_version_response.data else 0
            new_version_number = latest_version_number + 1

            version_id = uuid.uuid4()
            response = self._get_table("agent_versions").insert({
                "id": str(version_id),
                "agent_id": str(agent_id),
                "version_number": new_version_number,
                "system_prompt": system_prompt,
                "rules_jsonb": rules_jsonb,
                "created_by": str(created_by)
            }).execute()

            if not response.data:
                raise SupabaseUnavailableError("Failed to create draft version.")

            # Update agent's draft_version_id
            update_response = self._get_table("agents").update({"draft_version_id": str(version_id)}).eq("id", str(agent_id)).execute()
            if not update_response.data:
                logger.error(f"Failed to update agent {agent_id} draft_version_id to {version_id}", exc_info=True)
                raise SupabaseUnavailableError("Failed to link draft version to agent.")

            return version_id
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to create draft version for agent {agent_id}: {e}")

    def publish_version(self, agent_id: uuid.UUID, version_id: uuid.UUID) -> None:
        """
        Publishes a specific version of an agent by updating the agent's published_version_id.
        """
        try:
            update_response = self._get_table("agents").update({"published_version_id": str(version_id)}).eq("id", str(agent_id)).execute()
            if not update_response.data:
                raise SupabaseUnavailableError(f"Failed to publish version {version_id} for agent {agent_id}.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to publish version {version_id} for agent {agent_id}: {e}")

    def rollback_to_version(self, agent_id: uuid.UUID, version_id: uuid.UUID) -> None:
        """
        Rolls back an agent to a specific version. This makes the specified version
        both the new draft and the new published version.
        """
        try:
            # First, verify the version exists and belongs to the agent
            version_response = self._get_table("agent_versions").select("id, system_prompt, rules_jsonb").eq("id", str(version_id)).eq("agent_id", str(agent_id)).single().execute()
            if not version_response.data:
                raise exceptions.NotFound(f"Version {version_id} not found or does not belong to agent {agent_id}.")

            # Update both draft and published version IDs to this version
            update_response = self._get_table("agents").update({
                "draft_version_id": str(version_id),
                "published_version_id": str(version_id)
            }).eq("id", str(agent_id)).execute()

            if not update_response.data:
                raise SupabaseUnavailableError(f"Failed to rollback agent {agent_id} to version {version_id}.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to rollback agent {agent_id} to version {version_id}: {e}")

    def fetch_agent_templates(self) -> list[dict]:
        """
        Fetches all active agent templates from Supabase.
        """
        try:
            response = self._get_table("agent_templates").select("*").eq("is_active", True).execute()
            if response.data:
                return response.data
            else:
                return []
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch agent templates: {e}")

    def update_agent_trained_at(self, agent_id: uuid.UUID):
        """
        Updates the `trained_at` timestamp for a given agent.
        """
        try:
            response = self._get_table("agents").update({"trained_at": "now()"}).eq("id", str(agent_id)).execute()
            if not response.data:
                raise SupabaseUnavailableError(f"Failed to update trained_at for agent {agent_id}.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to update agent trained_at: {e}")


