import uuid
from typing import Dict, Any, List
from integrations.connectors.base import BaseConnector

class FileConnector(BaseConnector):
    """
    Connector for ingesting data from files (e.g., CSV, Excel, PDF).
    """
    @property
    def connector_type(self) -> str:
        return "file"

    @property
    def domain(self) -> str:
        # File connectors can apply to various domains, this would be specified in config
        return self.config.get("domain", "other") 

    def ingest_payload(self, payload: Dict[str, Any], entity_type: str) -> List[Dict[str, Any]]:
        """
        Processes a file-based payload (e.g., content extracted from a file).
        Payload expects 'text_content' and optionally 'original_filename', 'file_type'.
        Returns a list of canonical data records.
        """
        if 'text_content' not in payload:
            raise ValueError("FileConnector payload must contain 'text_content'.")
        
        text_content = payload['text_content']
        # For simplicity, each line or paragraph could be a separate record.
        # In a real scenario, this would parse CSV rows, PDF structure, etc.
        
        records = []
        # Example: Treat each paragraph as a record, or parse JSON lines
        for line in text_content.splitlines():
            if line.strip():
                normalized_record = self._normalize_data({"raw_data": line.strip()}, entity_type)
                if normalized_record:
                    records.append(normalized_record)
        return records

    def _normalize_data(self, raw_data: Dict[str, Any], entity_type: str) -> Dict[str, Any]:
        """
        Normalizes raw text content into a canonical model based on entity_type.
        """
        # This is a simplified example. Real normalization would be complex.
        canonical_record = {
            "workspace_id": self.workspace_id,
            "source_connector_id": self.connector_id,
            "source_reference": raw_data.get("source_reference", str(uuid.uuid4())), # Unique ID for this specific raw data entry
            "created_at": "now()", # Placeholder, DB will set
            "entity_type": entity_type,
            "data": raw_data["raw_data"] # Store the normalized content
        }

        # PII Masking hook
        canonical_record["data"] = self.mask_pii(canonical_record["data"])
        return canonical_record
