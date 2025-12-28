# backend/external_api/permissions.py

import json
import uuid
import logging
from functools import wraps
from django.http import JsonResponse
from rest_framework import status as drf_status

from backend.external_api.audit import ExternalApiAuditService

logger = logging.getLogger(__name__)

# --- Canonical Scope Definitions ---
# This dictionary defines all valid scopes in the system.
# The values can be descriptions, or more complex permission objects.
CANONICAL_SCOPES = {
    "events:write": "Allows writing (ingesting) external events.",
    "events:read": "Allows reading external events.",
    "status:read": "Allows reading the external API status.",
    # Future-safe scopes (not yet implemented in views, but defined)
    "conversations:read": "Allows reading conversation data.",
    "messages:read": "Allows reading message data.",
    "agents:read": "Allows reading agent configurations.",
    "analytics:read": "Allows reading analytics data.",
}

class MissingScopeError(Exception):
    pass

def check_scope(required_scope: str, available_scopes: Dict[str, bool]) -> bool:
    """
    Checks if the required scope is present and enabled in the available scopes.
    """
    return available_scopes.get(required_scope, False)

def require_scope(required_scope: str):
    """
    Decorator to enforce API key scopes for a view function.
    Assumes ExternalApiAuthMiddleware has already attached `request.external_api_context`
    containing `workspace_id`, `api_key_id`, and `scopes`.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            external_api_context = getattr(request, 'external_api_context', None)
            
            # This should ideally be handled by middleware before hitting views
            if not external_api_context:
                return JsonResponse({"detail": "Authentication context missing."}, status=drf_status.HTTP_401_UNAUTHORIZED)
            
            workspace_id = external_api_context.workspace_id
            api_key_id = external_api_context.api_key_id
            request_id = request.headers.get("X-Request-ID")
            
            scopes_for_key = external_api_context.scopes # This is the jsonb from DB
            
            permission_granted = check_scope(required_scope, scopes_for_key)
            
            # Extend audit log with scope usage and permission outcome
            # The middleware logs the call on response, but we need to pass this info.
            # Storing on request object to be picked up by middleware's process_response.
            request._external_api_scopes_used = scopes_for_key
            request._external_api_permission_granted = permission_granted
            request._external_api_required_scope = required_scope

            if not permission_granted:
                ExternalApiAuditService.log_call(
                    workspace_id=workspace_id,
                    api_key_id=api_key_id,
                    endpoint=request.path,
                    http_method=request.method,
                    status_code=drf_status.HTTP_403_FORBIDDEN,
                    request_id=request_id,
                    scopes_used=scopes_for_key,
                    permission_granted=False,
                )
                return JsonResponse(
                    {"detail": f"Forbidden: Missing required scope '{required_scope}'."},
                    status=drf_status.HTTP_403_FORBIDDEN
                )
            
            # If permission is granted, proceed to the view
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator
