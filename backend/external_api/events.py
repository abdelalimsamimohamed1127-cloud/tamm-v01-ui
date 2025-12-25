import uuid
from typing import Dict, Any

from rest_framework import exceptions
from external_api.supabase_repo import ExternalApiSupabaseRepo

import logging
from core.errors import SupabaseUnavailableError

logger = logging.getLogger(__name__)

class ExternalEventHandler:
    """
    Handles ingestion of external events.
    """
    def __init__(self, workspace_id: uuid.UUID, api_key_id: uuid.UUID):
        self.workspace_id = workspace_id
        self.api_key_id = api_key_id
        self.repo = ExternalApiSupabaseRepo()

    def process_external_event(self, event_type: str, payload: Dict[str, Any]):
        """
        Stores the event and conceptually forwards it.
        """
        logger.info(
            "Processing external event",
            extra={
                "workspace_id": self.workspace_id,
                "api_key_id": self.api_key_id,
                "event_type": event_type,
            },
        )
        try:
            event_id = self.repo.store_external_event(
                workspace_id=self.workspace_id,
                api_key_id=self.api_key_id,
                event_type=event_type,
                payload=payload
            )
            logger.info(f"Event '{event_type}' (ID: {event_id}) ingested for workspace {self.workspace_id}.")
            return event_id
        except SupabaseUnavailableError as e:
            logger.error(
                "Error storing external event",
                extra={"workspace_id": self.workspace_id, "api_key_id": self.api_key_id, "error": str(e)},
                exc_info=True,
            )
            raise e
        except Exception as e:
            logger.critical(
                "Unexpected error processing external event",
                extra={"workspace_id": self.workspace_id, "api_key_id": self.api_key_id, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException("An unexpected error occurred while processing the event.")
