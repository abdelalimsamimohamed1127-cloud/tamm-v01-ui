from datetime import datetime
import uuid
from decimal import Decimal
from typing import Optional, Dict, Any, List, TypedDict, Tuple

from django.db import connection
from psycopg2 import sql

logger = logging.getLogger(__name__)

# --- Reconciliation Report Types ---
class Issue(TypedDict):
    type: str
    workspace_id: str
    reference_id: str
    details: Dict[str, Any]

class ReconciliationSummary(TypedDict):
    payments_checked: int
    subscriptions_checked: int
    usage_events_checked: int
    wallets_checked: int
    workspaces_checked: int

class ReconciliationReport(TypedDict):
    ok: bool
    summary: ReconciliationSummary
    issues: List[Issue]

# --- Helper Functions ---
def _fetch_records(cursor, table_name: str, fields: List[str], where_clause: Optional[str] = None, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
    query = sql.SQL("SELECT {} FROM {}").format(
        sql.SQL(", ").join(map(sql.Identifier, fields)),
        sql.Identifier(table_name)
    )
    if where_clause:
        query = sql.SQL("{} WHERE {}").format(query, sql.SQL(where_clause))
    cursor.execute(query, params)
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]

class ReconciliationService:
    @staticmethod
    def run_reconciliation(
        *,
        from_date: datetime,
        to_date: datetime,
        workspace_id: Optional[uuid.UUID] = None
    ) -> ReconciliationReport:
        """
        Runs a comprehensive billing reconciliation check.
        Ensures consistency between payments, subscriptions, usage, and credits.
        """
        issues: List[Issue] = []
        payments_checked = 0
        subscriptions_checked = 0
        usage_events_checked = 0
        wallets_checked = 0
        workspaces_checked = 0
        
        with connection.cursor() as cursor:
            # --- Fetch relevant data for the period ---
            where_time_clause = "created_at BETWEEN %s AND %s"
            time_params = [from_date, to_date]

            # Adjust clause if workspace_id is provided
            workspace_filter_clause = ""
            if workspace_id:
                workspace_filter_clause = "AND workspace_id = %s"
                time_params.append(str(workspace_id))

            # Fetch payment requests
            payment_requests_raw = _fetch_records(cursor, "public.payment_requests",
                ["id", "workspace_id", "plan_key", "amount_egp", "provider", "status", "reference_code"],
                where_time_clause + workspace_filter_clause, time_params
            )
            payments_checked = len(payment_requests_raw)
            # Filter to confirmed payments for subscription mapping
            confirmed_payments = {
                (p['workspace_id'], p['id']): p for p in payment_requests_raw
                if p['status'] == 'confirmed' and p['provider'] == 'instapay'
            }
            # For Paymob, we assume 'provider_subscription_id' in public.subscriptions
            # maps to a Paymob transaction ID for initial payment, or a subscription ID for renewals.

            # Fetch subscriptions
            subscriptions_raw = _fetch_records(cursor, "public.subscriptions",
                ["id", "workspace_id", "plan_key", "status", "provider", "provider_subscription_id", "current_period_start", "current_period_end"],
                "updated_at BETWEEN %s AND %s" + workspace_filter_clause, time_params # Use updated_at for subscriptions
            )
            subscriptions_checked = len(subscriptions_raw)
            active_subscriptions = {s['workspace_id']: s for s in subscriptions_raw if s['status'] == 'active'}

            # Fetch usage events
            usage_events_raw = _fetch_records(cursor, "public.usage_events",
                ["id", "workspace_id", "quantity", "event_type", "idempotency_key"],
                where_time_clause + workspace_filter_clause, time_params
            )
            usage_events_checked = len(usage_events_raw)

            # Fetch workspace wallets
            # Wallets are current state, so no time filter needed here.
            # If workspace_id is present, filter by it.
            wallet_fields = ["workspace_id", "credits_remaining", "credits_used"]
            wallet_where_clause = f"workspace_id = '{str(workspace_id)}'" if workspace_id else None
            wallet_params = None
            if workspace_id:
                 wallet_where_clause = "workspace_id = %s"
                 wallet_params = [str(workspace_id)]

            wallets_raw = _fetch_records(cursor, "public.workspace_wallets", wallet_fields, wallet_where_clause, wallet_params)
            wallets_checked = len(wallets_raw)
            workspace_wallets = {w['workspace_id']: w for w in wallets_raw}

            # Fetch workspaces for names if needed
            workspaces_raw = _fetch_records(cursor, "public.workspaces", ["id", "name"],
                wallet_where_clause, wallet_params # reuse wallet filter for workspaces
            )
            workspaces_checked = len(workspaces_raw)
            workspace_names = {w['id']: w['name'] for w in workspaces_raw}

            # --- Reconciliation Checks ---

            # 1) Payments vs Subscriptions (Focus on InstaPay confirmed payments)
            for (ws_id, payment_req_id), payment in confirmed_payments.items():
                matching_subscription = next(
                    (s for s in subscriptions_raw
                     if s['workspace_id'] == ws_id and s['provider'] == 'instapay' and s['provider_subscription_id'] == str(payment_req_id) and s['status'] == 'active'),
                    None
                )
                if not matching_subscription:
                    issues.append({
                        "type": "missing_subscription_for_instapay_payment",
                        "workspace_id": ws_id,
                        "reference_id": str(payment_req_id),
                        "details": {
                            "payment_request_id": str(payment['id']),
                            "amount_egp": str(payment['amount_egp']),
                            "plan_key": payment['plan_key'],
                            "message": "Confirmed InstaPay payment does not have a corresponding active subscription."
                        }
                    })

            # 2) Subscriptions vs Wallets (Check expected credits based on active plan)
            for ws_id, sub in active_subscriptions.items():
                wallet = workspace_wallets.get(ws_id)
                if not wallet:
                    issues.append({
                        "type": "missing_wallet_for_active_subscription",
                        "workspace_id": ws_id,
                        "reference_id": str(sub['id']),
                        "details": {
                            "plan_key": sub['plan_key'],
                            "message": "Active subscription exists but no wallet found for workspace."
                        }
                    })
                else:
                    expected_monthly_credits = Decimal(0)
                    if sub['plan_key'] in ['starter', 'pro']: # Assuming 'free' has 0 or nominal credits
                        plan_config = next((p for k, p in PLANS_CONFIG.items() if k == sub['plan_key']), None)
                        if plan_config:
                            expected_monthly_credits = Decimal(plan_config.get("monthly_credits", 0))

                    # This check is complex as 'credits_used' is cumulative and 'credits_remaining' is dynamic.
                    # A more robust check would compare actual usage over the current period.
                    # For simplicity, we check if remaining is consistent with some basic logic.
                    if wallet['credits_remaining'] < 0: # Basic check: no negative balances
                        issues.append({
                            "type": "negative_credits_balance",
                            "workspace_id": ws_id,
                            "reference_id": str(sub['id']),
                            "details": {
                                "plan_key": sub['plan_key'],
                                "credits_remaining": str(wallet['credits_remaining']),
                                "message": "Workspace has negative credits remaining."
                            }
                        })
                    
                    # More advanced check would involve:
                    # 1. Summing usage_events within the current_period_start and now.
                    # 2. Comparing with expected_monthly_credits and credits_used.
                    # This is beyond current scope given lack of detailed usage period tracking in wallet.

            # 3) Usage vs Credits
            for ws_id, wallet in workspace_wallets.items():
                total_usage_for_wallet = sum(
                    Decimal(ue['quantity']) for ue in usage_events_raw if ue['workspace_id'] == ws_id
                )
                if wallet['credits_used'] != total_usage_for_wallet:
                    issues.append({
                        "type": "credits_used_mismatch",
                        "workspace_id": ws_id,
                        "reference_id": str(ws_id), # Reference to wallet
                        "details": {
                            "wallet_credits_used": str(wallet['credits_used']),
                            "sum_usage_events_quantity": str(total_usage_for_wallet),
                            "message": "Total credits used in wallet does not match sum of usage events quantity."
                        }
                    })
                # Check for negative credits remaining (already done above but can be re-iterated)
                if wallet['credits_remaining'] < 0:
                    issues.append({
                        "type": "negative_credits_remaining_from_wallet",
                        "workspace_id": ws_id,
                        "reference_id": str(ws_id),
                        "details": {"credits_remaining": str(wallet['credits_remaining'])}
                    })

            # 4) Provider Consistency (Paymob)
            # For Paymob, we need to compare Paymob webhook events (implicitly handled by subscription provider_subscription_id)
            # against actual subscriptions.
            # This would require accessing raw Paymob webhook payloads or an audit log of them.
            # Currently, public.subscriptions.provider_subscription_id is used.
            # Check for active Paymob subscriptions without a clear matching recent payment.
            # This is hard without external Paymob event log. Assuming provider_subscription_id for Paymob is unique txn ID.
            for sub in subscriptions_raw:
                if sub['provider'] == 'paymob' and sub['status'] == 'active':
                    # This check is difficult without an external "Paymob confirmed payments" log
                    # The `provider_subscription_id` is the Paymob Txn ID. A more robust check
                    # would ensure this Txn ID actually corresponds to a successful payment in Paymob's system.
                    pass 

            # Check for duplicate provider_reference
            provider_refs_seen: Dict[Tuple[str, str], List[str]] = {} # (provider, ref_id) -> [sub_ids]
            for sub in subscriptions_raw:
                key = (sub['provider'], sub['provider_subscription_id'])
                if key not in provider_refs_seen:
                    provider_refs_seen[key] = []
                provider_refs_seen[key].append(str(sub['id']))
            
            for (provider, ref_id), sub_ids in provider_refs_seen.items():
                if len(sub_ids) > 1:
                    issues.append({
                        "type": "duplicate_provider_reference",
                        "workspace_id": "N/A", # Cannot easily map to a single workspace if reference is shared
                        "reference_id": ref_id,
                        "details": {
                            "provider": provider,
                            "matching_subscription_ids": sub_ids,
                            "message": "Multiple subscriptions share the same provider reference. Check for inconsistencies."
                        }
                    })

        ok = not bool(issues)
        summary = {
            "payments_checked": payments_checked,
            "subscriptions_checked": subscriptions_checked,
            "usage_events_checked": usage_events_checked,
            "wallets_checked": wallets_checked,
            "workspaces_checked": workspaces_checked,
        }

        return {
            "ok": ok,
            "summary": summary,
            "issues": issues,
        }
