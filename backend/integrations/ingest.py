import uuid
import json
from typing import Dict, Any, List

from django.conf import settings
from rest_framework import serializers, exceptions

from integrations.supabase_repo import IntegrationsSupabaseRepo
from integrations.canonical import CanonicalModelFactory
from integrations.connectors.base import BaseConnector
from integrations.connectors.file import FileConnector
from integrations.connectors.api import ApiConnector
from integrations.connectors.webhook import WebhookConnector
from integrations.routing import IntegrationsRouter

# --- Connector Factory (for runtime instantiation) ---
CONNECTOR_CLASSES = {
    "file": FileConnector,
    "api": ApiConnector,
    "webhook": WebhookConnector,
}

# --- Serializers ---
class ConnectorSerializer(serializers.Serializer):
    """
    Serializer for creating/updating connector configurations.
    """
    connector_type = serializers.ChoiceField(choices=['file', 'api', 'webhook'])
    domain = serializers.ChoiceField(choices=['hr', 'erp', 'crm', 'ops', 'other'])
    auth_type = serializers.ChoiceField(choices=['none', 'api_key', 'oauth'], default='none')
    sync_mode = serializers.ChoiceField(choices=['manual', 'scheduled', 'push'], default='manual')
    config = serializers.JSONField(required=False, default=dict) # Sensitive config should be encrypted

class IngestPayloadSerializer(serializers.Serializer):
    """
    Serializer for the incoming ingestion payload.
    """
    connector_id = serializers.UUIDField()
    entity_type = serializers.ChoiceField(choices=CanonicalModelFactory.CANONICAL_ENTITY_TYPES.__args__) # Use args from Literal
    payload = serializers.JSONField()

# --- Ingestion Logic ---
import logging
from core.errors import SupabaseUnavailableError

logger = logging.getLogger(__name__)

class IngestionProcessor:
    """
    Core logic for processing incoming ingestion payloads.
    """
    def __init__(self, user_jwt: str, workspace_id: uuid.UUID):
        self.user_jwt = user_jwt
        self.workspace_id = workspace_id
        self.repo = IntegrationsSupabaseRepo(user_jwt)
        self.router = IntegrationsRouter(user_jwt, workspace_id)

    def _get_connector_instance(self, connector_config: Dict[str, Any]) -> BaseConnector:
        """
        Instantiates the correct connector class based on type.
        """
        connector_type = connector_config.get("connector_type")
        connector_class = CONNECTOR_CLASSES.get(connector_type)
        if not connector_class:
            raise exceptions.ValidationError(f"Unsupported connector type: {connector_type}")
        
        return connector_class(
            connector_id=uuid.UUID(connector_config["id"]),
            workspace_id=uuid.UUID(connector_config["workspace_id"]),
            config=connector_config["config"]
        )

    def process_ingestion(self, connector_id: uuid.UUID, entity_type: str, raw_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Fetches connector config, ingests payload, normalizes, and routes data.
        """
        logger.info(
            "Processing ingestion",
            extra={
                "workspace_id": self.workspace_id,
                "connector_id": connector_id,
                "entity_type": entity_type,
            },
        )
        try:
            connector_config = self.repo.get_connector(connector_id, self.workspace_id)
            connector_instance = self._get_connector_instance(connector_config)

            canonical_records_data = connector_instance.ingest_payload(raw_payload, entity_type)

            for record_data in canonical_records_data:
                record_data["workspace_id"] = self.workspace_id
                record_data["source_connector_id"] = connector_id
                record_data["entity_type"] = entity_type

            self.repo.store_canonical_data(entity_type, canonical_records_data)

            for record in canonical_records_data:
                self.router.route_canonical_data(record)
            
            self.repo.log_ingestion_event(
                workspace_id=self.workspace_id,
                connector_id=connector_id,
                entity_type=entity_type,
                status="success",
                details={"records_ingested": len(canonical_records_data)}
            )

            return canonical_records_data
        except (exceptions.NotFound, exceptions.ValidationError, SupabaseUnavailableError) as e:
            logger.warning(
                f"Error during ingestion processing: {e.__class__.__name__}",
                extra={"workspace_id": self.workspace_id, "connector_id": connector_id, "error": str(e)},
            )
            self.repo.log_ingestion_event(
                workspace_id=self.workspace_id,
                connector_id=connector_id,
                entity_type=entity_type,
                status="failed",
                details={"error": str(e)}
            )
            raise e
        except Exception as e:
            logger.error(
                "Unexpected error during ingestion processing",
                extra={"workspace_id": self.workspace_id, "connector_id": connector_id, "error": str(e)},
                exc_info=True,
            )
            self.repo.log_ingestion_event(
                workspace_id=self.workspace_id,
                connector_id=connector_id,
                entity_type=entity_type,
                status="failed",
                details={"error": "An unexpected error occurred."}
            )
            raise exceptions.APIException(f"An unexpected error occurred during ingestion: {e}")
