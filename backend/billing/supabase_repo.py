import os
import uuid
from supabase import create_client, Client
from django.conf import settings
from rest_framework import exceptions
from typing import Dict, Any, Optional
from core.errors import SupabaseUnavailableError

class BillingSupabaseRepo:
    """
    Repository for interacting with Supabase for billing data.
    """
    def __init__(self, user_jwt: str):
        self._client: Client = create_client(os.getenv("SUPABASE_URL", settings.SUPABASE_URL),
                                            os.getenv("SUPABASE_ANON_KEY", settings.SUPABASE_ANON_KEY),
                                            options={"headers": {"Authorization": f"Bearer {user_jwt}"}})

    def _get_table(self, table_name: str):
        return self._client.table(table_name)

    def get_workspace_credit_balance(self, workspace_id: uuid.UUID) -> int:
        """
        Fetches the current credit balance for a workspace.
        """
        try:
            response = self._get_table("workspace_credits").select("balance").eq("workspace_id", str(workspace_id)).single().execute()
            if not response.data:
                return 0 
            return response.data.get("balance", 0)
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch workspace credit balance: {e}")

    def deduct_credits(self, workspace_id: uuid.UUID, credits_to_deduct: int) -> bool:
        """
        Atomically deducts credits from a workspace's balance.
        """
        try:
            current_balance = self.get_workspace_credit_balance(workspace_id)

            if current_balance < credits_to_deduct:
                return False

            response = self._get_table("workspace_credits").update({
                "balance": current_balance - credits_to_deduct,
                "updated_at": "now()"
            }).eq("workspace_id", str(workspace_id)).gt("balance", credits_to_deduct - 1).execute()

            return bool(response.data)
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to deduct credits: {e}")

    def log_usage_event(self, workspace_id: uuid.UUID, event_type: str, credits_used: int,
                        agent_id: Optional[uuid.UUID] = None, channel: Optional[str] = None):
        """
        Logs a usage event to the usage_events table.
        """
        try:
            payload = {
                "id": str(uuid.uuid4()),
                "workspace_id": str(workspace_id),
                "event_type": event_type,
                "credits_used": credits_used,
                "created_at": "now()"
            }
            if agent_id:
                payload["agent_id"] = str(agent_id)
            if channel:
                payload["channel"] = channel
            
            response = self._get_table("usage_events").insert(payload).execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to log usage event.")
        except Exception as e:
            # In production, this should trigger an alert. For now, we raise an exception.
            raise SupabaseUnavailableError(detail=f"Failed to log usage event for workspace {workspace_id}: {e}")
