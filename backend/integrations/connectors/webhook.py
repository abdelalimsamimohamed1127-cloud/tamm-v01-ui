import uuid
from typing import Dict, Any, List
from integrations.connectors.base import BaseConnector

class WebhookConnector(BaseConnector):
    """
    Connector for ingesting data via webhooks (push-based).
    """
    @property
    def connector_type(self) -> str:
        return "webhook"

    @property
    def domain(self) -> str:
        return self.config.get("domain", "other")

    def ingest_payload(self, payload: Dict[str, Any], entity_type: str) -> List[Dict[str, Any]]:
        """
        Processes a payload received from a webhook.
        Payload is expected to be a single raw record.
        """
        # Webhooks typically send a single event/record per call
        normalized_record = self._normalize_data(payload, entity_type)
        if normalized_record:
            return [normalized_record]
        return []

    def _normalize_data(self, raw_data: Dict[str, Any], entity_type: str) -> Dict[str, Any]:
        """
        Normalizes raw webhook data into a canonical model based on entity_type.
        """
        # This is a placeholder for complex normalization logic.
        
        canonical_record = {
            "workspace_id": self.workspace_id,
            "source_connector_id": self.connector_id,
            "source_reference": raw_data.get("id", str(uuid.uuid4())), # Use external ID if available
            "created_at": "now()",
            "entity_type": entity_type,
            "data": self.mask_pii(raw_data) # Mask PII in the raw data itself
        }
        return canonical_record
