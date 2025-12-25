import os
import uuid
import hashlib
from supabase import create_client, Client
from django.conf import settings
from rest_framework import exceptions
from typing import Dict, Any, List, Optional

import logging
from core.errors import SupabaseUnavailableError

logger = logging.getLogger(__name__)

class ExternalApiSupabaseRepo:
    """
    Repository for interacting with Supabase for external API related data.
    """
    def __init__(self):
        self._client: Client = create_client(os.getenv("SUPABASE_URL"),
                                            os.getenv("SUPABASE_ANON_KEY"))

    def _get_table(self, table_name: str):
        return self._client.table(table_name)

    def log_api_call_audit(self, workspace_id: uuid.UUID, api_key_id: uuid.UUID, endpoint: str, 
                           status_code: int, request_payload_summary: Dict[str, Any], response_summary: Dict[str, Any]):
        """
        Logs details of every external API call for auditing and observability.
        """
        try:
            payload = {
                "id": str(uuid.uuid4()),
                "workspace_id": str(workspace_id),
                "api_key_id": str(api_key_id),
                "endpoint": endpoint,
                "status_code": status_code,
                "request_payload_summary": request_payload_summary,
                "response_summary": response_summary,
            }
            response = self._get_table("external_api_audit_logs").insert(payload).execute()
            if not response.data:
                logger.error(
                    "Failed to log API audit event",
                    extra={"workspace_id": workspace_id, "api_key_id": api_key_id}
                )
        except Exception as e:
            logger.critical(f"Failed to log API audit event: {e}", exc_info=True)

    def store_external_event(self, workspace_id: uuid.UUID, api_key_id: uuid.UUID, event_type: str, payload: Dict[str, Any]):
        """
        Stores an incoming external event.
        """
        try:
            event_id = uuid.uuid4()
            event_data = {
                "id": str(event_id),
                "workspace_id": str(workspace_id),
                "api_key_id": str(api_key_id),
                "event_type": event_type,
                "payload": payload,
            }
            response = self._get_table("external_events").insert(event_data).execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to store external event.")
            return event_id
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to store external event: {e}")

    def create_api_key(self, workspace_id: uuid.UUID, scopes: List[str]) -> str:
        """
        Generates a new API key and stores its hash and metadata.
        """
        try:
            raw_api_key = f"sk_{uuid.uuid4().hex}{uuid.uuid4().hex}"
            key_hash = hashlib.sha256(raw_api_key.encode('utf-8')).hexdigest()

            payload = {
                "workspace_id": str(workspace_id),
                "key_hash": key_hash,
                "scopes": scopes,
            }
            response = self._get_table("workspace_api_keys").insert(payload).execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to create API key.")
            return raw_api_key
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to create API key: {e}")

    def revoke_api_key(self, api_key_id: uuid.UUID, workspace_id: uuid.UUID) -> bool:
        """
        Revokes an API key by setting its revoked_at timestamp.
        """
        try:
            response = self._get_table("workspace_api_keys").update({"revoked_at": "now()"}) \
                                                             .eq("id", str(api_key_id)) \
                                                             .eq("workspace_id", str(workspace_id)).execute()
            return bool(response.data)
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to revoke API key: {e}")
