import logging
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from decimal import Decimal # Import Decimal type

from backend.security.audit import log_audit_event # Import the central audit helper

logger = logging.getLogger(__name__)

class AuditService:
    @staticmethod
    def log_event(
        event_type: str,
        workspace_id: uuid.UUID,
        provider: Optional[str] = None, # Renamed from 'provider' to be explicit for metadata
        reference_id: Optional[str] = None, # Resource ID relevant to the billing event
        actor_id: Optional[uuid.UUID] = None, # Added actor_id as it might be relevant for billing events (e.g., user changed plan)
        amount: Optional[Decimal] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        details: Optional[Dict[str, Any]] = None,
        # request_id, ip_address, user_agent are typically from request context, not directly here.
        # Can be passed via `details` if needed from the calling context.
    ):
        """
        Logs a critical billing event using the central audit logging helper.
        """
        try:
            # Prepare metadata for the central audit log
            metadata_payload: Dict[str, Any] = {
                "provider": provider,
                "amount": str(amount) if amount is not None else None,
                "before_state": before_state,
                "after_state": after_state,
                "details": details, # Additional event-specific details
            }
            # Clean up metadata_payload to remove None values
            metadata_payload = {k: v for k, v in metadata_payload.items() if v is not None}

            log_audit_event(
                workspace_id=workspace_id,
                actor_id=actor_id, # Can be None if system-initiated
                action=f"billing.{event_type}", # Prefix with 'billing.' for clarity
                resource=reference_id, # Reference ID can serve as the resource
                # request_id, ip_address, user_agent are not directly available here, pass as None
                request_id=None,
                ip_address=None,
                user_agent=None,
                metadata=metadata_payload
            )
        except Exception as e:
            logger.error(f"Failed to log billing audit event using central helper: {e}", exc_info=True)
            # Continue execution as audit logging is best-effort (fail-safe)

