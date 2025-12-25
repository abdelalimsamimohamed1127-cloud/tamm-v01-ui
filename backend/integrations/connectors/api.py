import uuid
from typing import Dict, Any, List
from integrations.connectors.base import BaseConnector

class ApiConnector(BaseConnector):
    """
    Connector for ingesting data from REST APIs (pull-based).
    """
    @property
    def connector_type(self) -> str:
        return "api"

    @property
    def domain(self) -> str:
        return self.config.get("domain", "other")

    def ingest_payload(self, payload: Dict[str, Any], entity_type: str) -> List[Dict[str, Any]]:
        """
        Processes a payload received from an API sync.
        Payload is expected to be a list of raw records or a single record.
        """
        raw_records = payload.get("records", [payload]) # Assume 'records' key or single payload

        normalized_records = []
        for raw_data in raw_records:
            normalized_record = self._normalize_data(raw_data, entity_type)
            if normalized_record:
                normalized_records.append(normalized_record)
        return normalized_records

    def _normalize_data(self, raw_data: Dict[str, Any], entity_type: str) -> Dict[str, Any]:
        """
        Normalizes raw API data into a canonical model based on entity_type.
        """
        # This is a placeholder for complex normalization logic.
        # For PII, specific fields (e.g., 'email', 'phone') would be masked.
        
        canonical_record = {
            "workspace_id": self.workspace_id,
            "source_connector_id": self.connector_id,
            "source_reference": raw_data.get("id", str(uuid.uuid4())), # Use external ID if available
            "created_at": "now()",
            "entity_type": entity_type,
            "data": self.mask_pii(raw_data) # Mask PII in the raw data itself
        }
        return canonical_record
