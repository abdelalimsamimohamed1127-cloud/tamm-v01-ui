from datetime import datetime, timedelta
import logging
from decimal import Decimal
import uuid
from typing import Optional, Dict, Any, List

from django.db import connection, transaction
from psycopg2 import sql
from backend.billing.audit import AuditService # Import AuditService

logger = logging.getLogger(__name__)

# Assuming a Plan mapping for now, this would ideally come from a DB or config
# NOT TO BE EXPOSED DIRECTLY TO FRONTEND, prices must be server-side
PLANS_CONFIG = {
    "free": {
        "name": "Free",
        "paymob_plan_id": None,
        "price_monthly_cents": 0,
        "monthly_credits": 100,
        "features": ["1 agent", "100 messages/mo"],
    },
    "starter": {
        "name": "Starter",
        "paymob_plan_id": "plan_starter_monthly", # Example Paymob plan ID
        "price_monthly_cents": 9900, # $99.00
        "monthly_credits": 2000,
        "features": ["5 agents", "2,000 messages/mo", "Email support"],
    },
    "pro": {
        "name": "Pro",
        "paymob_plan_id": "plan_pro_monthly", # Example Paymob plan ID
        "price_monthly_cents": 24900, # $249.00
        "monthly_credits": 10000,
        "features": ["10 agents", "10,000 messages/mo", "Priority support"],
    },
}

def calculate_period_dates(startDate: datetime) -> Dict[str, datetime]:
    """Calculates start and end dates for a monthly subscription period."""
    start = startDate
    end = startDate + timedelta(days=30) # Approx one month for simplicity. Use more robust logic for exact month.
    return {"start": start, "end": end}

class SubscriptionService:

    @staticmethod
    def get_available_plans() -> List[Dict[str, Any]]:
        """
        Retrieves a list of available plans.
        """
        # In a real scenario, this might fetch from a 'plans' table
        # For now, return the hardcoded config, excluding paymob_plan_id for frontend exposure
        plans_for_frontend = []
        for key, plan_data in PLANS_CONFIG.items():
            plan_copy = plan_data.copy()
            plan_copy["plan_key"] = key
            plan_copy.pop("paymob_plan_id", None) # Do not expose Paymob internal IDs to frontend
            # Convert price_monthly_cents to a display format if needed, but for now just pass as is.
            plans_for_frontend.append(plan_copy)
        return plans_for_frontend

    @staticmethod
    def get_workspace_current_plan(workspace_id: uuid.UUID) -> Dict[str, Any]:
        """
        Retrieves the current active plan for a given workspace.
        """
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("""
                    SELECT
                        s.plan_key,
                        s.status,
                        s.current_period_end,
                        s.provider, -- Added provider to select
                        ws.plan_key as settings_plan_key
                    FROM public.subscriptions s
                    LEFT JOIN public.workspace_settings ws ON s.workspace_id = ws.workspace_id
                    WHERE s.workspace_id = %s AND s.status = 'active'
                    ORDER BY s.current_period_end DESC
                    LIMIT 1;
                """),
                [str(workspace_id)]
            )
            row = cursor.fetchone()

            if row:
                plan_key, status, current_period_end, provider, settings_plan_key = row
                plan_details = PLANS_CONFIG.get(plan_key, PLANS_CONFIG["free"]).copy()
                plan_details["plan_key"] = plan_key
                plan_details["status"] = status
                plan_details["current_period_end"] = current_period_end.isoformat() if current_period_end else None
                plan_details["provider"] = provider # Include provider in returned details
                # Use the plan_key from workspace_settings as the authoritative source
                # if subscription is active, otherwise default to free.
                plan_details["is_current_in_settings"] = (settings_plan_key == plan_key)
                return plan_details
            
            # If no active subscription, return the 'free' plan details
            free_plan = PLANS_CONFIG["free"].copy()
            free_plan["plan_key"] = "free"
            free_plan["status"] = "active" # Assume free is always active
            free_plan["current_period_end"] = None
            free_plan["provider"] = "none" # No provider for free plan
            free_plan["is_current_in_settings"] = True # Free plan is always current
            return free_plan


    @staticmethod
    def initiate_paymob_checkout(workspace_id: uuid.UUID, plan_key: str) -> str:
        """
        Initiates a Paymob checkout for a plan upgrade and returns the payment URL.
        """
        plan_data = PLANS_CONFIG.get(plan_key)
        if not plan_data or plan_key == "free":
            raise ValueError("Invalid plan selected for upgrade or free plan selected.")

        price_cents = plan_data["price_monthly_cents"]
        paymob_plan_id = plan_data["paymob_plan_id"]

        if not paymob_plan_id:
            raise ValueError(f"Paymob plan ID not configured for plan_key: {plan_key}")

        # --- Paymob API Integration (Placeholder) ---
        # In a real scenario, this would involve calling Paymob APIs:
        # 1. Authenticate with Paymob to get authentication token.
        # 2. Create an order with items (the subscription plan) and amount.
        #    Use workspace_id as merchant_order_id for webhook reconciliation.
        # 3. Request a payment key for the order.
        # 4. Construct the payment URL using the payment key.
        
        # For demonstration purposes, we'll return a dummy URL.
        # You would typically pass details like workspace_id, amount, plan_key
        # as metadata or in the merchant_order_id to retrieve in the webhook.
        dummy_payment_url = (
            f"https://accept.paymob.com/api/acceptance/iframes/{{IFRAME_ID}}"
            f"?payment_token={{PAYMENT_TOKEN}}&workspace_id={workspace_id}&plan_key={plan_key}"
            f"&amount_cents={price_cents}" # Pass amount for potential InstaPay comparison
        )
        logger.info(f"Initiated Paymob checkout for workspace {workspace_id}, plan {plan_key}")
        AuditService.log_event(
            event_type="payment_initiated",
            workspace_id=workspace_id,
            provider="paymob",
            reference_id=f"checkout_{uuid.uuid4()}", # Unique reference for this initiation attempt
            amount=Decimal(price_cents) / 100,
            before_state={"plan_key": plan_key},
            after_state={"status": "initiated", "payment_url": "dummy"},
            details={"plan_key": plan_key, "price_cents": price_cents},
        )
        return dummy_payment_url

    @staticmethod
    def activate_subscription(
        workspace_id: uuid.UUID,
        plan_key: str,
        provider: str, # 'paymob' or 'instapay'
        provider_subscription_id: str, # Unique ID from payment provider (e.g., Paymob txn ID or InstaPay payment_request ID)
        current_period_start: Optional[datetime] = None,
        current_period_end: Optional[datetime] = None,
    ):
        """
        Activates a plan for a workspace, updating subscriptions and workspace_settings.
        This is the core logic for plan activation, used by both Paymob success and InstaPay confirmation.
        Ensures idempotency.
        """
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Calculate period dates if not provided
                if not current_period_start or not current_period_end:
                    period = calculate_period_dates(datetime.now())
                    current_period_start = period["start"]
                    current_period_end = period["end"]

                # Check for existing active subscription with the same provider_subscription_id and plan_key
                # This ensures idempotency for renewals or multiple webhook hits
                cursor.execute(
                    sql.SQL("""
                        SELECT id, current_period_end
                        FROM public.subscriptions
                        WHERE workspace_id = %s
                          AND plan_key = %s
                          AND provider = %s
                          AND provider_subscription_id = %s
                          AND status = 'active';
                    """),
                    [str(workspace_id), plan_key, provider, provider_subscription_id]
                )
                existing_active_sub = cursor.fetchone()

                if existing_active_sub:
                    sub_id, existing_period_end = existing_active_sub
                    # If existing subscription is active and period end is after current, it's already processed or renewed.
                    # Or, if this is a renewal for an existing subscription, update its end date.
                    if existing_period_end and existing_period_end > current_period_end:
                         logger.info(
                            f"Idempotent activation: Subscription {sub_id} for workspace {workspace_id} "
                            f"already active with current or later period end. No update needed."
                        )
                         return # Already active with same or later period, do nothing
                    else:
                        # Update end date for renewal or ensuring latest period
                        cursor.execute(
                            sql.SQL("""
                                UPDATE public.subscriptions
                                SET current_period_start = %s,
                                    current_period_end = %s,
                                    updated_at = NOW()
                                WHERE id = %s;
                            """),
                            [current_period_start, current_period_end, sub_id]
                        )
                        logger.info(
                            f"Subscription {sub_id} for workspace {workspace_id} renewed/updated to plan {plan_key}."
                        )
                        AuditService.log_event(
                            event_type="subscription_changed",
                            workspace_id=workspace_id,
                            provider=provider,
                            reference_id=provider_reference,
                            before_state={"status": existing_status, "current_period_end": existing_period_end.isoformat() if existing_period_end else None},
                            after_state={"status": "active", "current_period_start": current_period_start.isoformat(), "current_period_end": current_period_end.isoformat(), "plan_key": plan_key},
                            details={"subscription_id": str(sub_id), "action": "renewed/updated"},
                        )
                        # Also update workspace settings to ensure current plan is reflected
                        SubscriptionService._update_workspace_settings_plan(workspace_id, plan_key)
                        return


                # If no existing active subscription found with the same provider_subscription_id, insert a new one
                # or update a prior non-active one.
                # For simplicity and to ensure single active subscription, we will try to find the latest
                # subscription record for this workspace and update it if it's not active/expired,
                # otherwise insert a new one.
                cursor.execute(
                    sql.SQL("""
                        SELECT id
                        FROM public.subscriptions
                        WHERE workspace_id = %s
                        ORDER BY current_period_end DESC NULLS LAST
                        LIMIT 1;
                    """),
                    [str(workspace_id)]
                )
                latest_sub_row = cursor.fetchone()

                if latest_sub_row:
                    # Update the latest subscription for this workspace
                    sub_id_to_update = latest_sub_row[0]
                    cursor.execute(
                        sql.SQL("""
                            UPDATE public.subscriptions
                            SET plan_key = %s,
                                status = 'active',
                                current_period_start = %s,
                                current_period_end = %s,
                                provider = %s,
                                provider_subscription_id = %s,
                                updated_at = NOW()
                            WHERE id = %s;
                        """),
                        [
                            plan_key,
                            current_period_start,
                            current_period_end,
                            provider,
                            provider_subscription_id,
                            sub_id_to_update
                        ]
                    )
                    logger.info(
                        f"Subscription {sub_id_to_update} for workspace {workspace_id} activated/updated to plan {plan_key}."
                    )
                else:
                    # Insert a completely new subscription
                    new_sub_id = uuid.uuid4()
                    cursor.execute(
                        sql.SQL("""
                            INSERT INTO public.subscriptions
                                (id, workspace_id, plan_key, status, current_period_start,
                                 current_period_end, provider, provider_subscription_id, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW());
                        """),
                        [
                            str(new_sub_id),
                            str(workspace_id),
                            plan_key,
                            'active',
                            current_period_start,
                            current_period_end,
                            provider,
                            provider_subscription_id,
                        ]
                    )
                    logger.info(
                        f"New subscription {new_sub_id} for workspace {workspace_id} activated to plan {plan_key} "
                        f"via {provider} (reference: {provider_subscription_id})."
                    )
                    AuditService.log_event(
                        event_type="subscription_activated",
                        workspace_id=workspace_id,
                        provider=provider,
                        reference_id=provider_subscription_id,
                        amount=None, # Amount is not directly part of subscription activation, but payment event has it
                        before_state={"status": "none"}, # Assuming no prior subscription state
                        after_state={"status": "active", "plan_key": plan_key, "current_period_start": current_period_start.isoformat(), "current_period_end": current_period_end.isoformat()},
                        details={"subscription_id": str(new_sub_id), "action": "new_activation"},
                    )
                
                # Update public.workspace_settings.plan_key
                SubscriptionService._update_workspace_settings_plan(workspace_id, plan_key)

    @staticmethod
    def _update_workspace_settings_plan(workspace_id: uuid.UUID, plan_key: str):
        """Helper to update or insert workspace_settings plan_key."""
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("""
                    UPDATE public.workspace_settings
                    SET plan_key = %s,
                        updated_at = NOW()
                    WHERE workspace_id = %s;
                """),
                [plan_key, str(workspace_id)]
            )
            if cursor.rowcount == 0:
                cursor.execute(
                    sql.SQL("""
                        INSERT INTO public.workspace_settings (workspace_id, plan_key, updated_at)
                        VALUES (%s, %s, NOW());
                    """),
                    [str(workspace_id), plan_key]
                )
        logger.info(f"Workspace settings plan_key for {workspace_id} updated to {plan_key}.")

    @staticmethod
    def update_subscription_and_workspace_plan(
        workspace_id: uuid.UUID,
        plan_key: str,
        status: str, # 'active', 'pending', 'canceled', 'expired'
        provider_subscription_id: Optional[str],
        current_period_start: Optional[datetime],
        current_period_end: Optional[datetime],
        idempotency_key: Optional[str] = None # Paymob event ID for idempotency
    ):
        """
        Handles general subscription updates (e.g., from webhooks).
        Calls activate_plan if the status is 'active'.
        """
        if status == 'active':
            # Delegate to activate_plan for active status
            SubscriptionService.activate_subscription(
                workspace_id=workspace_id,
                plan_key=plan_key,
                provider='paymob', # Assuming this is called from Paymob webhook flow
                provider_subscription_id=provider_subscription_id or str(uuid.uuid4()), # Ensure a UUID if none provided
                current_period_start=current_period_start,
                current_period_end=current_period_end,
            )
            logger.info(
                f"Paymob-triggered activation for workspace {workspace_id} to plan {plan_key} completed via activate_plan."
            )
            return

        with transaction.atomic():
            with connection.cursor() as cursor:
                # Handle non-active statuses directly
                existing_sub_id = None
                if provider_subscription_id:
                    cursor.execute(
                        sql.SQL("SELECT id FROM public.subscriptions WHERE provider_subscription_id = %s LIMIT 1;"),
                        [provider_subscription_id]
                    )
                    result = cursor.fetchone()
                    if result:
                        existing_sub_id = result[0]
                
                # If we're updating a non-active status, ensure we're updating the correct subscription
                # or creating one if it doesn't exist (e.g., for 'pending' state before activation).
                if existing_sub_id:
                    cursor.execute(
                        sql.SQL("""
                            UPDATE public.subscriptions
                            SET plan_key = %s,
                                status = %s,
                                current_period_start = %s,
                                current_period_end = %s,
                                updated_at = NOW()
                            WHERE id = %s;
                        """),
                        [
                            plan_key,
                            status,
                            current_period_start,
                            current_period_end,
                            existing_sub_id
                        ]
                    )
                    logger.info(f"Subscription {existing_sub_id} status updated to {status} for workspace {workspace_id}.")
                    AuditService.log_event(
                        event_type="subscription_changed",
                        workspace_id=workspace_id,
                        provider="paymob", # Assuming this path is primarily for Paymob non-active updates
                        reference_id=provider_subscription_id,
                        before_state={"status": "unknown_previous_state"}, # Cannot easily fetch previous status here without another query
                        after_state={"status": status, "plan_key": plan_key},
                        details={"subscription_id": str(existing_sub_id), "action": f"status_updated_to_{status}"},
                    )
                else:
                    # Insert a new record if not found (e.g., first 'pending' status)
                    new_sub_id = uuid.uuid4()
                    cursor.execute(
                        sql.SQL("""
                            INSERT INTO public.subscriptions
                                (id, workspace_id, plan_key, status, current_period_start,
                                 current_period_end, provider, provider_subscription_id, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW());
                        """),
                        [
                            str(new_sub_id),
                            str(workspace_id),
                            plan_key,
                            status,
                            current_period_start,
                            current_period_end,
                            'paymob', # Assuming this is for paymob
                            provider_subscription_id,
                        ]
                    )
                    logger.info(f"New subscription {new_sub_id} with status {status} inserted for workspace {workspace_id}.")
                    AuditService.log_event(
                        event_type="subscription_changed", # Or subscription_created if this is the very first entry
                        workspace_id=workspace_id,
                        provider="paymob",
                        reference_id=provider_subscription_id,
                        before_state={"status": "none"},
                        after_state={"status": status, "plan_key": plan_key},
                        details={"subscription_id": str(new_sub_id), "action": f"new_subscription_inserted_with_status_{status}"},
                    )
