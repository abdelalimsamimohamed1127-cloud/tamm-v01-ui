# backend/security/audit.py

import uuid
import datetime
import logging
from typing import Optional, Dict, Any

from django.db import connection
from psycopg2 import sql

logger = logging.getLogger(__name__)

# Assuming the audit logs table is named 'external_api_audit_logs'
# as per the task's RLS audit list.
# If a more generic 'audit_logs' table exists, it should be used instead.
AUDIT_LOGS_TABLE = "external_api_audit_logs"

def log_audit_event(
    workspace_id: uuid.UUID,
    action: str,
    actor_id: Optional[uuid.UUID] = None, # user_id or api_key_id
    resource: Optional[str] = None,
    request_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Logs an audit event to the central audit stream table.
    Logs must be append-only.
    """
    try:
        with connection.cursor() as cursor:
            # Generate a new UUID for the audit log entry
            audit_id = uuid.uuid4()
            
            # Use NOW() for created_at to ensure append-only timestamp
            cursor.execute(
                sql.SQL(f"""
                    INSERT INTO public.{AUDIT_LOGS_TABLE} (
                        id, workspace_id, actor, action, resource, request_id, ip, user_agent, created_at, metadata
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), %s);
                """),
                [
                    str(audit_id),
                    str(workspace_id),
                    str(actor_id) if actor_id else None,
                    action,
                    resource,
                    request_id,
                    ip_address,
                    user_agent,
                    metadata, # psycopg2 handles dict to jsonb conversion
                ]
            )
        logger.info(
            f"Audit event logged: action={action}, workspace_id={workspace_id}, actor={actor_id}",
            extra={"audit_id": str(audit_id), "action": action, "workspace_id": str(workspace_id), "actor": str(actor_id)}
        )
    except Exception as e:
        logger.error(f"Failed to log audit event: {e}", exc_info=True)
        # It's critical that audit logging failures do NOT crash the main application flow.
        pass