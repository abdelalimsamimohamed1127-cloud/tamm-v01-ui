import uuid
import logging
from decimal import Decimal
from typing import Optional, Dict, Any, TypedDict
import psycopg2
from psycopg2 import sql
from django.conf import settings
from django.db import transaction, connection
from backend.billing.audit import AuditService # Import AuditService

logger = logging.getLogger(__name__)

class DeductionResult(TypedDict):
    success: bool
    message: str
    new_credits_remaining: Optional[Decimal]

def deduct_credits(
    *,
    workspace_id: uuid.UUID,
    agent_id: Optional[uuid.UUID],
    cost: Decimal,
    event_type: str,
    idempotency_key: Optional[str] = None
) -> DeductionResult:
    """
    Deducts credits from a workspace's wallet atomically within a database transaction.
    Ensures no negative balances and handles idempotency.

    Args:
        workspace_id: The ID of the workspace.
        agent_id: The ID of the agent (optional).
        cost: The amount of credits to deduct.
        event_type: The type of usage event (e.g., "ai_message").
        idempotency_key: Optional key to ensure no duplicate deductions for retried requests.

    Returns:
        DeductionResult indicating success or reason for failure.
    """
    if cost <= 0:
        return {"success": False, "message": "Cost must be positive.", "new_credits_remaining": None}

    try:
        # Use Django's transaction.atomic for a managed transaction block.
        # This will handle BEGIN/COMMIT/ROLLBACK.
        with transaction.atomic():
            # Get the database connection for raw SQL operations if needed,
            # or directly use Django ORM methods with select_for_update().
            # Given the lack of explicit models, we'll try to get the connection details
            # and use psycopg2.
            # However, the most "Django-idiomatic" way would be to have models.
            # Since explicit models are not found, and we need raw SQL transaction semantics
            # with FOR UPDATE, we must use a direct cursor from Django's connection.

            # Get the current database connection's cursor
            with connection.cursor() as cursor:
                # 1. Lock workspace_wallets row FOR UPDATE and get current credits
                cursor.execute(
                    sql.SQL("SELECT credits_remaining FROM public.workspace_wallets WHERE workspace_id = %s FOR UPDATE;"),
                    [str(workspace_id)]
                )
                wallet_data = cursor.fetchone()

                if not wallet_data:
                    return {"success": False, "message": "Workspace wallet not found.", "new_credits_remaining": None}

                current_credits_remaining = Decimal(wallet_data[0])

                # 2. Check if idempotency_key already exists in usage_events
                if idempotency_key:
                    cursor.execute(
                        sql.SQL("SELECT id FROM public.usage_events WHERE workspace_id = %s AND idempotency_key = %s;"),
                        [str(workspace_id), idempotency_key]
                    )
                    if cursor.fetchone():
                        logger.info(
                            f"Idempotent deduction: {idempotency_key} already processed for workspace {workspace_id}.",
                            extra={"workspace_id": workspace_id, "idempotency_key": idempotency_key}
                        )
                        # Return success for an already processed idempotent request
                        return {"success": True, "message": "Idempotent request already processed.", "new_credits_remaining": current_credits_remaining}

                # 3. Verify credits_remaining >= cost
                if current_credits_remaining < cost:
                    return {"success": False, "message": "Insufficient credits.", "new_credits_remaining": current_credits_remaining}

                # 4. Insert usage_events row
                new_usage_event_id = uuid.uuid4()
                cursor.execute(
                    sql.SQL("""
                        INSERT INTO public.usage_events (id, workspace_id, agent_id, event_type, quantity, idempotency_key, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, NOW());
                    """),
                    [
                        str(new_usage_event_id),
                        str(workspace_id),
                        str(agent_id) if agent_id else None,
                        event_type,
                        cost,
                        idempotency_key,
                    ]
                )

                # 5. Update workspace_wallets
                updated_credits_remaining = current_credits_remaining - cost
                cursor.execute(
                    sql.SQL("""
                        UPDATE public.workspace_wallets
                        SET credits_remaining = %s,
                            credits_used = credits_used + %s,
                            updated_at = NOW()
                        WHERE workspace_id = %s;
                    """),
                    [
                        updated_credits_remaining,
                        cost,
                        str(workspace_id),
                    ]
                )

                logger.info(
                    f"Credits deducted successfully for workspace {workspace_id}. Cost: {cost}, Remaining: {updated_credits_remaining}",
                    extra={
                        "workspace_id": workspace_id,
                        "agent_id": agent_id,
                        "cost": cost,
                        "event_type": event_type,
                        "idempotency_key": idempotency_key,
                        "credits_before": current_credits_remaining,
                        "credits_after": updated_credits_remaining,
                    }
                )
                AuditService.log_event(
                    event_type="credits_deducted",
                    workspace_id=workspace_id,
                    provider="system", # Deduction is a system event
                    reference_id=idempotency_key or str(new_usage_event_id),
                    amount=cost,
                    before_state={"credits_remaining": current_credits_remaining},
                    after_state={"credits_remaining": updated_credits_remaining},
                    details={"event_type": event_type, "agent_id": str(agent_id) if agent_id else None},
                )
                return {"success": True, "message": "Credits deducted successfully.", "new_credits_remaining": updated_credits_remaining}

    except psycopg2.Error as db_err:
        logger.error(
            f"Database error during credit deduction for workspace {workspace_id}: {db_err}",
            exc_info=True,
            extra={
                "workspace_id": workspace_id,
                "agent_id": agent_id,
                "cost": cost,
                "event_type": event_type,
                "idempotency_key": idempotency_key,
            }
        )
        AuditService.log_event(
            event_type="credits_deduction_failed",
            workspace_id=workspace_id,
            provider="system",
            reference_id=idempotency_key or "unknown",
            amount=cost,
            before_state={"credits_remaining": "unknown"}, # Can't reliably get before state if DB error
            after_state={"credits_remaining": "unchanged"},
            details={"error": str(db_err), "event_type": event_type, "reason": "db_error"},
        )
        # Rollback is handled by transaction.atomic() on exception exit
        return {"success": False, "message": f"Database error: {db_err}", "new_credits_remaining": None}
    except Exception as e:
        logger.error(
            f"Unexpected error during credit deduction for workspace {workspace_id}: {e}",
            exc_info=True,
            extra={
                "workspace_id": workspace_id,
                "agent_id": agent_id,
                "cost": cost,
                "event_type": event_type,
                "idempotency_key": idempotency_key,
            }
        )
        AuditService.log_event(
            event_type="credits_deduction_failed",
            workspace_id=workspace_id,
            provider="system",
            reference_id=idempotency_key or "unknown",
            amount=cost,
            before_state={"credits_remaining": "unknown"},
            after_state={"credits_remaining": "unchanged"},
            details={"error": str(e), "event_type": event_type, "reason": "unexpected_error"},
        )
        # Rollback is handled by transaction.atomic() on exception exit
        return {"success": False, "message": f"An unexpected error occurred: {e}", "new_credits_remaining": None}