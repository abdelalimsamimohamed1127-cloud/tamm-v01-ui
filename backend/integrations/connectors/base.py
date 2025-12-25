import uuid
from typing import Dict, Any, Literal, Optional

class BaseConnector:
    """
    Abstract base class for all external data connectors.
    Defines the common interface for connector types.
    """
    def __init__(self, connector_id: uuid.UUID, workspace_id: uuid.UUID, config: Dict[str, Any]):
        self.connector_id = connector_id
        self.workspace_id = workspace_id
        self.config = config # Configuration specific to the connector instance

    @property
    def connector_type(self) -> Literal["file", "api", "webhook"]:
        raise NotImplementedError("Subclasses must define connector_type.")

    @property
    def domain(self) -> Literal["hr", "erp", "crm", "ops", "other"]:
        raise NotImplementedError("Subclasses must define domain.")

    @property
    def auth_type(self) -> Literal["none", "api_key", "oauth"]:
        return self.config.get("auth_type", "none")

    @property
    def sync_mode(self) -> Literal["manual", "scheduled", "push"]:
        return self.config.get("sync_mode", "manual")

    def validate_config(self) -> None:
        """Validates the connector's configuration."""
        # Common validation, subclasses extend
        if not self.connector_id or not self.workspace_id:
            raise ValueError("Connector must have an ID and be linked to a workspace.")
        if not self.config:
            raise ValueError("Connector configuration cannot be empty.")

    def ingest_payload(self, payload: Dict[str, Any], entity_type: str) -> List[Dict[str, Any]]:
        """
        Processes an incoming raw payload and normalizes it into canonical models.
        Returns a list of canonical data records.
        """
        raise NotImplementedError("Subclasses must implement ingest_payload.")

    def _normalize_data(self, raw_data: Dict[str, Any], entity_type: str) -> Dict[str, Any]:
        """
        Abstract method for normalizing raw data into a canonical model.
        Subclasses will implement this based on the domain and entity type.
        """
        raise NotImplementedError("Subclasses must implement _normalize_data.")

    def mask_pii(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Applies PII masking rules to canonical data.
        Placeholder for now.
        """
        # For MVP, a simple placeholder. In a real system, this would use a PII masking library.
        masked_data = data.copy()
        if 'email' in masked_data:
            masked_data['email'] = '***@***.com'
        if 'phone' in masked_data:
            masked_data['phone'] = '***-***-****'
        return masked_data
