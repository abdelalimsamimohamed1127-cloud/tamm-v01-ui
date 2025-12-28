from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
import uuid
import logging

from backend.billing.subscriptions import SubscriptionService
from backend.billing.instapay import InstaPayService

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["GET"])
def get_available_plans_api(request):
    """
    API endpoint to retrieve available subscription plans.
    """
    try:
        plans = SubscriptionService.get_available_plans()
        # Add InstaPay config to plans for frontend display
        instapay_config = InstaPayService.get_instapay_config()
        return JsonResponse({"plans": plans, "instapay_config": instapay_config})
    except Exception as e:
        logger.error(f"Error retrieving available plans: {e}", exc_info=True)
        return JsonResponse({"error": "Failed to retrieve plans."}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def get_current_workspace_plan_api(request, workspace_id_str):
    """
    API endpoint to retrieve the current active plan for a specific workspace.
    """
    try:
        workspace_id = uuid.UUID(workspace_id_str)
        current_plan = SubscriptionService.get_workspace_current_plan(workspace_id)
        return JsonResponse({"current_plan": current_plan})
    except ValueError:
        return JsonResponse({"error": "Invalid workspace ID."}, status=400)
    except Exception as e:
        logger.error(f"Error getting current plan for workspace {workspace_id_str}: {e}", exc_info=True)
        return JsonResponse({"error": "Failed to retrieve current plan."}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def initiate_paymob_checkout_api(request):
    """
    API endpoint to initiate Paymob checkout for a plan upgrade.
    Returns a Paymob payment URL.
    """
    try:
        data = json.loads(request.body)
        workspace_id = uuid.UUID(data.get("workspace_id"))
        plan_key = data.get("plan_key")

        if not workspace_id or not plan_key:
            return JsonResponse({"error": "Missing workspace_id or plan_key."}, status=400)

        payment_url = SubscriptionService.initiate_paymob_checkout(workspace_id, plan_key)
        return JsonResponse({"payment_url": payment_url})
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        logger.error(f"Error initiating Paymob checkout: {e}", exc_info=True)
        return JsonResponse({"error": "Failed to initiate payment. Please try again later."}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def create_instapay_payment_request_api(request):
    """
    API endpoint to create a new InstaPay payment request.
    """
    try:
        data = json.loads(request.body)
        workspace_id = uuid.UUID(data.get("workspace_id"))
        plan_key = data.get("plan_key")
        user_instapay_reference = data.get("user_instapay_reference")
        proof_url = data.get("proof_url")

        if not workspace_id or not plan_key or not user_instapay_reference:
            return JsonResponse({"error": "Missing workspace_id, plan_key, or user_instapay_reference."}, status=400)
        
        payment_request_data = InstaPayService.create_payment_request(
            workspace_id=workspace_id,
            plan_key=plan_key,
            user_instapay_reference=user_instapay_reference,
            proof_url=proof_url,
        )
        return JsonResponse(payment_request_data, status=201)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        logger.error(f"Error creating InstaPay payment request: {e}", exc_info=True)
        return JsonResponse({"error": "Failed to create InstaPay payment request. Please try again later."}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
# @admin_required # Placeholder for RBAC decorator
def get_pending_instapay_requests_api(request):
    """
    Admin API endpoint to retrieve all pending InstaPay payment requests.
    Requires admin privileges.
    """
    try:
        # RBAC: Ensure request.user has admin privileges here
        # if not request.user.is_admin:
        #     return JsonResponse({"error": "Forbidden"}, status=403)

        pending_requests = InstaPayService.get_pending_instapay_requests()
        return JsonResponse({"pending_requests": pending_requests})
    except Exception as e:
        logger.error(f"Error retrieving pending InstaPay requests: {e}", exc_info=True)
        return JsonResponse({"error": "Failed to retrieve pending InstaPay requests."}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
# @admin_required # Placeholder for RBAC decorator
def confirm_instapay_payment_api(request):
    """
    Admin API endpoint to confirm an InstaPay payment request.
    Requires admin privileges.
    """
    try:
        # RBAC: Ensure request.user has admin privileges here
        # if not request.user.is_admin:
        #     return JsonResponse({"error": "Forbidden"}, status=403)
            
        data = json.loads(request.body)
        payment_request_id = uuid.UUID(data.get("payment_request_id"))
        # admin_user_id = request.user.id # This would typically come from authenticated user
        admin_user_id = uuid.UUID(data.get("admin_user_id", uuid.uuid4())) # Placeholder if not authenticated yet

        if not payment_request_id or not admin_user_id:
            return JsonResponse({"error": "Missing payment_request_id or admin_user_id."}, status=400)
        
        InstaPayService.confirm_payment_request(
            payment_request_id=payment_request_id,
            admin_user_id=admin_user_id,
        )
        return JsonResponse({"message": f"Payment request {payment_request_id} confirmed."}, status=200)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        logger.error(f"Error confirming InstaPay payment request: {e}", exc_info=True)
        return JsonResponse({"error": "Failed to confirm InstaPay payment request. Please try again later."}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
# @admin_required # Placeholder for RBAC decorator
def reject_instapay_payment_api(request):
    """
    Admin API endpoint to reject an InstaPay payment request.
    Requires admin privileges.
    """
    try:
        # RBAC: Ensure request.user has admin privileges here
        # if not request.user.is_admin:
        #     return JsonResponse({"error": "Forbidden"}, status=403)

        data = json.loads(request.body)
        payment_request_id = uuid.UUID(data.get("payment_request_id"))
        # admin_user_id = request.user.id # This would typically come from authenticated user
        admin_user_id = uuid.UUID(data.get("admin_user_id", uuid.uuid4())) # Placeholder if not authenticated yet

        if not payment_request_id or not admin_user_id:
            return JsonResponse({"error": "Missing payment_request_id or admin_user_id."}, status=400)
        
        InstaPayService.reject_payment_request(
            payment_request_id=payment_request_id,
            admin_user_id=admin_user_id,
        )
        return JsonResponse({"message": f"Payment request {payment_request_id} rejected."}, status=200)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        logger.error(f"Error rejecting InstaPay payment request: {e}", exc_info=True)
        return JsonResponse({"error": "Failed to reject InstaPay payment request. Please try again later."}, status=500)
