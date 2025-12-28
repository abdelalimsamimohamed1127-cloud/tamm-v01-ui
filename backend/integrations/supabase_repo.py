import os
import uuid
from supabase import create_client, Client
from django.conf import settings
from rest_framework import exceptions
from typing import Dict, Any, Optional, List
import datetime

from core.errors import SupabaseUnavailableError

class IntegrationsSupabaseRepo:
    """
    Repository for interacting with Supabase for integrations data.
    """
    def __init__(self, user_jwt: str):
        self._client: Client = create_client(os.getenv("SUPABASE_URL"),
                                            os.getenv("SUPABASE_ANON_KEY"),
                                            options={"headers": {"Authorization": f"Bearer {user_jwt}"}})

    def _get_table(self, table_name: str):
        return self._client.table(table_name)

    def list_connectors(self, workspace_id: uuid.UUID) -> List[Dict[str, Any]]:
        """
        Fetches all connectors for a given workspace.
        """
        try:
            response = self._get_table("connectors").select("*").eq("workspace_id", str(workspace_id)).execute()
            return response.data if response.data else []
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to list connectors: {e}")

    def create_connector(self, workspace_id: uuid.UUID, connector_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new connector configuration in Supabase.
        Initializes status to 'inactive' and last_sync_at to None.
        The 'config' field will store non-sensitive wizard-collected fields.
        """
        try:
            connector_id = uuid.uuid4()
            # Construct config with non-sensitive fields
            config_payload = {
                "domain": connector_data.get("domain", "other"),
                "auth_type": connector_data.get("auth_type", "api_key"),
                "sync_mode": connector_data.get("sync_mode", "manual"),
                # Add any other non-sensitive fields collected by the wizard to config
            }

            payload = {
                "id": str(connector_id),
                "workspace_id": str(workspace_id),
                "type": connector_data["type"], # Use 'type' as per data model
                "name": connector_data["name"],
                "config": config_payload,
                "status": "inactive", # Default status
                "last_sync_at": None,
                "created_at": datetime.datetime.now().isoformat(),
            }
            response = self._get_table("connectors").insert(payload).execute()
            if response.data:
                return response.data[0]
            raise SupabaseUnavailableError("Failed to create connector.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to create connector: {e}")

    def get_connector(self, connector_id: uuid.UUID, workspace_id: uuid.UUID) -> Dict[str, Any]:
        """
        Fetches a connector configuration by ID for a specific workspace.
        """
        try:
            response = self._get_table("connectors").select("*").eq("id", str(connector_id)).eq("workspace_id", str(workspace_id)).single().execute()
            if not response.data:
                raise exceptions.NotFound(f"Connector {connector_id} not found or not accessible in workspace {workspace_id}.")
            return response.data
        except exceptions.NotFound:
            raise
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to get connector: {e}")
    
    def update_connector_status(self, connector_id: uuid.UUID, workspace_id: uuid.UUID, status: str, last_sync_at: Optional[datetime.datetime] = None) -> Dict[str, Any]:
        """
        Updates the status and last_sync_at for a connector.
        """
        try:
            update_data = {"status": status}
            if last_sync_at:
                update_data["last_sync_at"] = last_sync_at.isoformat()
            else:
                update_data["last_sync_at"] = None # Explicitly set to null if not provided

            response = self._get_table("connectors").update(update_data).eq("id", str(connector_id)).eq("workspace_id", str(workspace_id)).execute()
            if response.data:
                return response.data[0]
            raise SupabaseUnavailableError("Failed to update connector status.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to update connector status: {e}")

    def store_canonical_data(self, entity_type: str, records: List[Dict[str, Any]]):
        """
        Stores normalized canonical data records into the respective Supabase table.
        """
        try:
            table_name_map = {
                "employee_profile": "employee_profiles",
                "employee_event": "employee_events",
                "employee_kpi": "employee_kpis",
                "employee_complaint": "employee_complaints",
                "policy_document": "policy_documents",
            }
            table_name = table_name_map.get(entity_type)
            if not table_name:
                raise exceptions.APIException(f"Unsupported entity type for canonical storage: {entity_type}")

            for record in records:
                record["workspace_id"] = str(record["workspace_id"])
                record["source_connector_id"] = str(record["source_connector_id"])
                if "id" not in record:
                     record["id"] = str(uuid.uuid4())

            response = self._get_table(table_name).insert(records).execute()
            if not response.data:
                raise SupabaseUnavailableError(f"Failed to store canonical {entity_type} data.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to store canonical data: {e}")

    def log_ingestion_event(self, workspace_id: uuid.UUID, connector_id: uuid.UUID, entity_type: str, status: str, details: Dict[str, Any]):
        """
        Logs an ingestion event for auditing purposes.
        """
        try:
            payload = {
                "workspace_id": str(workspace_id),
                "connector_id": str(connector_id),
                "entity_type": entity_type,
                "status": status,
                "details": details,
            }
            response = self._get_table("ingestion_logs").insert(payload).execute()
            if not response.data:
                # Log to system logger instead of raising an exception for an audit log failure
                print(f"WARNING: Failed to log ingestion event for workspace {workspace_id}.")
        except Exception as e:
            print(f"CRITICAL: Failed to log ingestion event: {e}")
