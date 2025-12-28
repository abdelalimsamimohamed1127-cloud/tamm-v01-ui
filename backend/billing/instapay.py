from datetime import datetime
import uuid
import logging
from decimal import Decimal
from typing import Optional, Dict, Any, List

from django.db import connection, transaction
from psycopg2 import sql
from backend.billing.subscriptions import SubscriptionService, PLANS_CONFIG # Import PLANS_CONFIG for amount validation
from backend.billing.audit import AuditService # Import AuditService

logger = logging.getLogger(__name__)

# InstaPay configuration - Placeholder for actual handles/bank names
INSTAPAY_CONFIG = {
    "handle": "your.instapay.handle",
    "bank_name": "Your Bank Name",
    "account_number": "Your Account Number (optional, for display)"
}

class InstaPayService:

    @staticmethod
    def get_instapay_config() -> Dict[str, str]:
        """
        Returns the InstaPay configuration details for display on the frontend.
        """
        return INSTAPAY_CONFIG

    @staticmethod
    def create_payment_request(
        workspace_id: uuid.UUID,
        plan_key: str,
        user_instapay_reference: str, # User-entered transaction number
        proof_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Creates a pending InstaPay payment request.
        Generates a unique human-readable reference_code for the user to include in their transfer.
        """
        if not user_instapay_reference:
            raise ValueError("User's InstaPay transaction reference is required.")

        plan_data = PLANS_CONFIG.get(plan_key)
        if not plan_data:
            raise ValueError(f"Invalid plan_key: {plan_key}")
        
        # Amount in EGP (assuming amount_cents in PLANS_CONFIG is for EGP)
        amount_egp = Decimal(plan_data["price_monthly_cents"]) / 100 
        if amount_egp <= 0:
            raise ValueError("Cannot create payment request for free plan or zero amount.")

        # Generate a unique, human-readable reference code for the user to include
        # Example: first 8 chars of UUID + part of plan_key + timestamp
        unique_ref_base = str(uuid.uuid4()).replace("-", "")[:8].upper()
        # Add a short suffix from the plan_key to make it more identifiable
        plan_suffix = "".join([word[0] for word in plan_key.split('_')]).upper()
        human_readable_ref = f"TMM-{plan_suffix}-{unique_ref_base}"

        with transaction.atomic():
            with connection.cursor() as cursor:
                # Check if this human_readable_ref already exists (highly unlikely but for safety)
                cursor.execute(
                    sql.SQL("SELECT id FROM public.payment_requests WHERE reference_code = %s;"),
                    [human_readable_ref]
                )
                if cursor.fetchone():
                    raise ValueError("Generated reference code collision. Please retry.")

                # Insert payment_requests row
                payment_request_id = uuid.uuid4()
                cursor.execute(
                    sql.SQL("""
                        INSERT INTO public.payment_requests (
                            id, workspace_id, plan_key, amount_egp, provider, status,
                            reference_code, user_instapay_reference, proof_url, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW());
                    """),
                    [
                        str(payment_request_id),
                        str(workspace_id),
                        plan_key,
                        amount_egp,
                        'instapay',
                        'pending',
                        human_readable_ref,
                        user_instapay_reference,
                        proof_url,
                    ]
                )
                logger.info(
                    f"InstaPay payment request created: {payment_request_id} for workspace {workspace_id} "
                    f"plan {plan_key}, amount {amount_egp} EGP. Reference: {human_readable_ref}"
                )
                return {
                    "id": str(payment_request_id),
                    "workspace_id": str(workspace_id),
                    "plan_key": plan_key,
                    "amount_egp": str(amount_egp),
                    "reference_code": human_readable_ref,
                    "status": "pending",
                    "instapay_handle": INSTAPAY_CONFIG["handle"],
                    "bank_name": INSTAPAY_CONFIG["bank_name"],
                }

    @staticmethod
    def get_pending_instapay_requests() -> List[Dict[str, Any]]:
        """
        Retrieves all pending InstaPay payment requests for admin review.
        Includes workspace name.
        """
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("""
                    SELECT
                        pr.id,
                        pr.workspace_id,
                        w.name as workspace_name, -- Assuming public.workspaces table with 'name'
                        pr.plan_key,
                        pr.amount_egp,
                        pr.reference_code,
                        pr.user_instapay_reference,
                        pr.proof_url,
                        pr.created_at,
                        pr.status
                    FROM public.payment_requests pr
                    JOIN public.workspaces w ON pr.workspace_id = w.id
                    WHERE pr.provider = 'instapay' AND pr.status = 'pending'
                    ORDER BY pr.created_at ASC;
                """)
            )
            columns = [col[0] for col in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]


    @staticmethod
    def confirm_payment_request(
        payment_request_id: uuid.UUID,
        admin_user_id: uuid.UUID,
    ):
        """
        Admin action to confirm a pending InstaPay payment request.
        Activates the plan and updates the payment request status.
        """
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Lock payment request row for update
                cursor.execute(
                    sql.SQL("""
                        SELECT workspace_id, plan_key, status, amount_egp, reference_code
                        FROM public.payment_requests
                        WHERE id = %s FOR UPDATE;
                    """),
                    [str(payment_request_id)]
                )
                request_data = cursor.fetchone()

                if not request_data:
                    AuditService.log_event(
                        event_type="payment_confirmation_failed",
                        workspace_id=uuid.UUID(str(uuid.uuid4())), # Dummy workspace_id if not found
                        provider="instapay",
                        reference_id=str(payment_request_id),
                        details={"reason": "payment_request_not_found"},
                    )
                    raise ValueError(f"Payment request {payment_request_id} not found.")
                
                workspace_id, plan_key, current_status, amount_egp, reference_code = request_data

                if current_status == 'confirmed':
                    AuditService.log_event(
                        event_type="payment_confirmation_failed",
                        workspace_id=workspace_id,
                        provider="instapay",
                        reference_id=str(payment_request_id),
                        details={"reason": "already_confirmed", "current_status": current_status},
                    )
                    raise ValueError(f"Payment request {payment_request_id} is already confirmed.")
                if current_status == 'rejected':
                    AuditService.log_event(
                        event_type="payment_confirmation_failed",
                        workspace_id=workspace_id,
                        provider="instapay",
                        reference_id=str(payment_request_id),
                        details={"reason": "already_rejected", "current_status": current_status},
                    )
                    raise ValueError(f"Payment request {payment_request_id} has been rejected.")
                if current_status != 'pending':
                    AuditService.log_event(
                        event_type="payment_confirmation_failed",
                        workspace_id=workspace_id,
                        provider="instapay",
                        reference_id=str(payment_request_id),
                        details={"reason": "unexpected_status", "current_status": current_status},
                    )
                    raise ValueError(f"Payment request {payment_request_id} has unexpected status: {current_status}")

                # Mark payment_requests.status = 'confirmed'
                cursor.execute(
                    sql.SQL("""
                        UPDATE public.payment_requests
                        SET status = 'confirmed',
                            confirmed_at = NOW(),
                            confirmed_by = %s
                        WHERE id = %s;
                    """),
                    [str(admin_user_id), str(payment_request_id)]
                )

                # Call subscriptions.activate_subscription
                SubscriptionService.activate_subscription(
                    workspace_id=workspace_id,
                    plan_key=plan_key,
                    provider="instapay",
                    provider_reference=str(payment_request_id),
                )
                logger.info(
                    f"InstaPay payment request {payment_request_id} for workspace {workspace_id} confirmed by admin {admin_user_id}. "
                    f"Plan {plan_key} activated."
                )
                AuditService.log_event(
                    event_type="payment_confirmed",
                    workspace_id=workspace_id,
                    provider="instapay",
                    reference_id=str(payment_request_id),
                    amount=amount_egp,
                    before_state={"status": "pending"},
                    after_state={"status": "confirmed", "plan_key": plan_key},
                    details={"admin_user_id": str(admin_user_id), "reference_code": reference_code},
                )

    @staticmethod
    def reject_payment_request(
        payment_request_id: uuid.UUID,
        admin_user_id: uuid.UUID,
    ):
        """
        Admin action to reject a pending InstaPay payment request.
        Updates the payment request status. No plan change occurs.
        """
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Lock payment request row for update
                cursor.execute(
                    sql.SQL("""
                        SELECT status, workspace_id, plan_key, amount_egp, reference_code
                        FROM public.payment_requests
                        WHERE id = %s FOR UPDATE;
                    """),
                    [str(payment_request_id)]
                )
                request_data = cursor.fetchone()

                if not request_data:
                    AuditService.log_event(
                        event_type="payment_rejection_failed",
                        workspace_id=uuid.UUID(str(uuid.uuid4())), # Dummy workspace_id if not found
                        provider="instapay",
                        reference_id=str(payment_request_id),
                        details={"reason": "payment_request_not_found"},
                    )
                    raise ValueError(f"Payment request {payment_request_id} not found.")
                
                current_status, workspace_id, plan_key, amount_egp, reference_code = request_data

                if current_status == 'confirmed':
                    AuditService.log_event(
                        event_type="payment_rejection_failed",
                        workspace_id=workspace_id,
                        provider="instapay",
                        reference_id=str(payment_request_id),
                        details={"reason": "already_confirmed", "current_status": current_status},
                    )
                    raise ValueError(f"Payment request {payment_request_id} is already confirmed and cannot be rejected.")
                if current_status == 'rejected':
                    AuditService.log_event(
                        event_type="payment_rejection_failed",
                        workspace_id=workspace_id,
                        provider="instapay",
                        reference_id=str(payment_request_id),
                        details={"reason": "already_rejected", "current_status": current_status},
                    )
                    raise ValueError(f"Payment request {payment_request_id} is already rejected.")
                if current_status != 'pending':
                    AuditService.log_event(
                        event_type="payment_rejection_failed",
                        workspace_id=workspace_id,
                        provider="instapay",
                        reference_id=str(payment_request_id),
                        details={"reason": "unexpected_status", "current_status": current_status},
                    )
                    raise ValueError(f"Payment request {payment_request_id} has unexpected status: {current_status}")

                # Mark payment_requests.status = 'rejected'
                cursor.execute(
                    sql.SQL("""
                        UPDATE public.payment_requests
                        SET status = 'rejected',
                            confirmed_at = NOW(), # Using confirmed_at for rejection timestamp too
                            confirmed_by = %s
                        WHERE id = %s;
                    """),
                    [str(admin_user_id), str(payment_request_id)]
                )
                logger.info(
                    f"InstaPay payment request {payment_request_id} rejected by admin {admin_user_id}."
                )
                AuditService.log_event(
                    event_type="payment_rejected",
                    workspace_id=workspace_id,
                    provider="instapay",
                    reference_id=str(payment_request_id),
                    amount=amount_egp,
                    before_state={"status": "pending"},
                    after_state={"status": "rejected", "plan_key": plan_key},
                    details={"admin_user_id": str(admin_user_id), "reference_code": reference_code},
                )