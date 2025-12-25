from django.conf import settings
from rest_framework import exceptions
from django.utils.deprecation import MiddlewareMixin
import uuid
from typing import Callable, Optional

from billing.credits import CreditEnforcer
from billing.rate_limit import RateLimiter

import logging

logger = logging.getLogger(__name__)

class BillingMiddleware(MiddlewareMixin):
    """
    Middleware to enforce rate limits and credit deductions for specific API endpoints.
    """
    RATE_LIMIT_CONFIG = {
        "/api/v1/ai/chat": {"requests_per_minute": 60},
        "/api/v1/analytics/insights": {"requests_per_minute": 10},
        "/api/v1/channels/event": {"requests_per_minute": 120},
        "/api/v1/copilot/insights/chat": {"requests_per_minute": 10},
        "/api/v1/integrations/ingest": {"requests_per_minute": 30},
        "/api/v1/external/agent/run": {"requests_per_minute": 30},
        "/api/v1/external/events": {"requests_per_minute": 100},
        "/api/v1/external/data/ingest": {"requests_per_minute": 20},
    }

    def __init__(self, get_response: Callable):
        self.get_response = get_response
        self.rate_limiters: Dict[str, RateLimiter] = {}
        for endpoint, config in self.RATE_LIMIT_CONFIG.items():
            self.rate_limiters[endpoint] = RateLimiter(requests_per_minute=config["requests_per_minute"])

    def process_view(self, request, view_func, view_args, view_kwargs):
        if not hasattr(request, 'user_id') or not hasattr(request, 'workspace_id'):
            return None

        workspace_id = request.workspace_id
        user_jwt = request.auth
        path = request.path_info

        rate_limiter_key: Optional[str] = None
        for endpoint_prefix in self.RATE_LIMIT_CONFIG.keys():
            if path.startswith(endpoint_prefix):
                rate_limiter_key = endpoint_prefix
                break

        if rate_limiter_key:
            rate_limiter = self.rate_limiters[rate_limiter_key]
            try:
                rate_limiter.check_and_apply_rate_limit(workspace_id, rate_limiter_key)
            except exceptions.Throttled as e:
                logger.warning(
                    "Rate limit exceeded",
                    extra={"workspace_id": workspace_id, "path": path},
                )
                raise e

        if path.startswith("/api/v1/ai/chat") and request.method == 'POST':
            if not user_jwt:
                raise exceptions.AuthenticationFailed("JWT missing for credit enforcement.")
            
            try:
                credit_enforcer = CreditEnforcer(user_jwt)
                credit_enforcer.check_and_deduct_ai_credit(
                    workspace_id=workspace_id, 
                    agent_id=None,
                    channel=None
                )
                logger.info(
                    "AI credit deducted",
                    extra={"workspace_id": workspace_id},
                )
            except exceptions.PaymentRequired as e:
                logger.warning(
                    "Insufficient credits for AI chat",
                    extra={"workspace_id": workspace_id},
                )
                raise e
            except Exception as e:
                logger.error(
                    "Error during credit enforcement",
                    extra={"workspace_id": workspace_id, "error": str(e)},
                    exc_info=True,
                )
                raise exceptions.APIException("Could not process credit deduction.")

        return None
