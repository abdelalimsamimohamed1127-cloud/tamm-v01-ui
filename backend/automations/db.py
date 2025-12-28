import os
import logging
from uuid import UUID
from typing import List, Dict, Any

from supabase import create_client, Client

from .registry import EVENT_TRIGGERS

logger = logging.getLogger(__name__)

class AutomationsRepository:
    """
    Repository for interacting with the 'automations' table in Supabase.
    """
    _client: Client

    def __init__(self):
        # NOTE: A backend service like this should ideally use the Supabase
        # service role key, but we are following the existing pattern which
        # uses the anon key.
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set.")
        
        self._client = create_client(supabase_url, supabase_key)

    def get_enabled_automations_for_trigger(
        self,
        workspace_id: UUID,
        event_name: str
    ) -> List[Dict[str, Any]]:
        """
        Fetches all enabled automations for a workspace that are registered
        to handle the given event trigger.
        """
        # Get the list of automation keys that can be triggered by this event.
        automation_keys_for_event = EVENT_TRIGGERS.get(event_name)
        if not automation_keys_for_event:
            logger.debug(f"No automations registered for event: {event_name}")
            return []

        try:
            response = self._client.table("automations").select("*") \
                .eq("workspace_id", str(workspace_id)) \
                .eq("enabled", True) \
                .in_("key", automation_keys_for_event) \
                .execute()

            if response.data:
                return response.data
            return []
        except Exception as e:
            logger.error(
                "Failed to fetch automations from Supabase",
                extra={"workspace_id": workspace_id, "event_name": event_name, "error": str(e)},
                exc_info=True,
            )
            # In case of a DB error, we must not crash the parent pipeline.
            # Return an empty list and let the process continue.
            return []

# Singleton instance of the repository
automations_repo = AutomationsRepository()
