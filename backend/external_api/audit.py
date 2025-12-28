# backend/external_api/audit.py

import logging
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
# from django.db import connection # No longer needed for direct DB access
# from psycopg2 import sql # No longer needed for direct DB access

from backend.security.audit import log_audit_event # Import the central audit helper

logger = logging.getLogger(__name__)

class ExternalApiAuditService:
    @staticmethod
    def log_call(
        workspace_id: uuid.UUID,
        api_key_id: Optional[uuid.UUID],
        endpoint: str,
        http_method: str,
        status_code: Optional[int],
        request_id: Optional[str],
        ip_address: Optional[str] = None, # New parameter
        user_agent: Optional[str] = None, # New parameter
        scopes_used: Optional[Dict[str, bool]] = None,
        permission_granted: Optional[bool] = None,
        metadata: Optional[Dict[str, Any]] = None, # New parameter for additional metadata
    ):
        """
        Logs an external API call event using the central audit logging helper.
        """
        try:
            # Determine a suitable action string
            action = "api_call"
            if status_code == 401:
                action = "api_auth_failed"
            elif status_code == 403 and metadata and metadata.get("reason") == "ip_blocked":
                action = "ip_blocked"
            elif status_code == 403 and metadata and metadata.get("reason") == "signature_failed":
                action = "signature_failed"
            # Add more specific actions based on status_code or metadata as needed

            log_audit_event(
                workspace_id=workspace_id,
                actor_id=api_key_id,
                action=action,
                resource=endpoint, # Endpoint is the resource for API calls
                request_id=request_id,
                ip_address=ip_address,
                user_agent=user_agent,
                metadata={
                    "http_method": http_method,
                    "status_code": status_code,
                    "scopes_used": scopes_used,
                    "permission_granted": permission_granted,
                    **(metadata or {}) # Merge any additional metadata passed in
                }
            )
            # The logging.info is now handled by the central log_audit_event,
            # but can be kept here for additional context if desired.
            # logger.info(
            #     f"AUDIT: External API call logged for workspace {workspace_id} "
            #     f"endpoint={endpoint} method={http_method} status={status_code} "
            #     f"scopes_used={scopes_used} permission_granted={permission_granted}"
            # )
        except Exception as e:
            logger.error(
                f"Failed to log external API call using central helper: {e}",
                exc_info=True,
                extra={
                    "workspace_id": workspace_id, "api_key_id": api_key_id,
                    "endpoint": endpoint, "http_method": http_method,
                    "status_code": status_code, "request_id": request_id,
                    "scopes_used": scopes_used, "permission_granted": permission_granted,
                    "ip_address": ip_address, "user_agent": user_agent,
                }
            )
            # Continue execution as audit logging is best-effort (fail-safe)
