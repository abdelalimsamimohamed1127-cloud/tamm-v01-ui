import uuid
from typing import Dict, Any, List

from rest_framework import exceptions

from integrations.ingest import IngestionProcessor # Reuse core ingestion logic
from integrations.serializers import IngestPayloadSerializer # Reuse serializer for validation


import uuid
from typing import Dict, Any, List
from rest_framework import exceptions
from integrations.ingest import IngestionProcessor
from integrations.serializers import IngestPayloadSerializer
import logging
from core.errors import SupabaseUnavailableError, AIAProviderError

logger = logging.getLogger(__name__)

class ExternalDataIngestor:
    """
    Handles data ingestion from external systems via API key.
    """
    def __init__(self, workspace_id: uuid.UUID, api_key_id: uuid.UUID, user_jwt: str):
        self.workspace_id = workspace_id
        self.api_key_id = api_key_id
        self.ingestion_processor = IngestionProcessor(
            user_jwt=user_jwt,
            workspace_id=workspace_id
        )

    def ingest_data(self, connector_id: uuid.UUID, entity_type: str, raw_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes external data for ingestion.
        """
        logger.info(
            "Processing external data ingestion",
            extra={
                "workspace_id": self.workspace_id,
                "api_key_id": self.api_key_id,
                "connector_id": connector_id,
                "entity_type": entity_type,
            },
        )
        try:
            canonical_records = self.ingestion_processor.process_ingestion(
                connector_id=connector_id,
                entity_type=entity_type,
                raw_payload=raw_payload
            )
            return {"status": "ingested", "records_count": len(canonical_records)}
        except (exceptions.NotFound, exceptions.ValidationError, SupabaseUnavailableError, AIAProviderError) as e:
            logger.warning(
                f"Error during data ingestion: {e.__class__.__name__}",
                extra={"workspace_id": self.workspace_id, "api_key_id": self.api_key_id, "error": str(e)},
            )
            raise e
        except Exception as e:
            logger.error(
                "Unexpected error during data ingestion",
                extra={"workspace_id": self.workspace_id, "api_key_id": self.api_key_id, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException(f"An unexpected error occurred during ingestion: {e}")
