import logging
from django.http import HttpResponse, JsonResponse
from django.conf import settings
from backend.billing.rate_limit import increment_and_check, get_rate_limit

logger = logging.getLogger(__name__)

class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        logger.info("RateLimitMiddleware initialized.")

    def __call__(self, request):
        # We assume workspace_id is resolved and attached to the request
        # by an earlier middleware or process.
        workspace_id = getattr(request, 'workspace_id', None)
        
        if not workspace_id:
            logger.warning("No workspace_id found on request. Skipping rate limiting.")
            return self.get_response(request)

        # Assuming workspace_settings is also attached to the request
        # If not, you might need to fetch it from the DB here or rely on a default plan.
        # For this task, we assume it's available or default to "free".
        plan_key = getattr(request, 'plan_key', None) # Assuming plan_key might be directly on request from earlier middleware
        if not plan_key:
            workspace_settings = getattr(request, 'workspace_settings', None)
            if workspace_settings and hasattr(workspace_settings, 'plan_key'):
                plan_key = workspace_settings.plan_key
            else:
                plan_key = "free" # Default to free if plan_key is not found or settings are missing
                logger.debug(f"Plan key not found for workspace {workspace_id}. Defaulting to '{plan_key}'.")

        result = increment_and_check(str(workspace_id), plan_key)

        if not result["allowed"]:
            logger.warning(
                f"Rate limit exceeded for workspace {workspace_id} (Plan: {plan_key}). "
                f"Count: {result['current_count']}, Limit: {get_rate_limit(plan_key)['limit']}"
            )
            response = JsonResponse(
                {"status": 429, "message": "Rate limit exceeded for workspace"},
                status=429,
            )
            response["Retry-After"] = result["retry_after"]
            return response

        return self.get_response(request)