# backend/external_api/middleware.py

import json
import uuid
import logging
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from rest_framework import status as drf_status

from backend.external_api.auth import get_api_key_and_workspace
from backend.external_api.audit import ExternalApiAuditService
from backend.external_api.permissions import CANONICAL_SCOPES # Import canonical scopes for audit if needed
from backend.security.ip_allowlist import is_ip_allowed # Import the new IP allowlist helper
from backend.security.hmac import verify_hmac_signature # Import the HMAC verification helper

# Placeholder for existing Rate Limiting and Billing modules
# These would typically be part of `backend.billing` as per previous tasks.
# Assume they have callable interfaces like:
# from backend.billing.rate_limit import RateLimitService
# from backend.billing.credits import deduct_credits as billing_deduct_credits

logger = logging.getLogger(__name__)

# A custom attribute to attach workspace_id and api_key_id to the request
# This makes it available in subsequent views.
class RequestContext:
    def __init__(self, workspace_id: uuid.UUID, api_key_id: uuid.UUID, scopes: Dict[str, bool]):
        self.workspace_id = workspace_id
        self.api_key_id = api_key_id
        self.scopes = scopes # Attach scopes here

class ExternalApiAuthMiddleware(MiddlewareMixin):
    def process_request(self, request):
        # Only process requests for the external API path
        if not request.path.startswith("/api/v1/external/"):
            return None # Continue with other middleware/views

        # Extract client IP and user agent early
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        client_ip = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT')

        # Attach to request for later use in process_response or views if needed
        request._client_ip = client_ip
        request._user_agent = user_agent

        # 1. Authenticate API key
        auth_header = request.headers.get("Authorization")
        api_key_auth_result = get_api_key_and_workspace(auth_header)

        workspace_id: Optional[uuid.UUID] = None
        api_key_id: Optional[uuid.UUID] = None
        scopes: Dict[str, bool] = {} # Default to no scopes

        if api_key_auth_result:
            api_key_id, workspace_id, scopes = api_key_auth_result
            request.api_key_id = api_key_id
            request.workspace_id = workspace_id
            request.scopes = scopes # Attach scopes to request object directly
        else:
            # Audit unauthorized attempts
            ExternalApiAuditService.log_call(
                workspace_id=uuid.UUID(str(uuid.uuid4())), # Dummy for unauthorized
                api_key_id=None,
                endpoint=request.path,
                http_method=request.method,
                status_code=drf_status.HTTP_401_UNAUTHORIZED,
                request_id=request.headers.get("X-Request-ID"),
                ip_address=client_ip, # Pass ip_address
                user_agent=user_agent, # Pass user_agent
                scopes_used={},
                permission_granted=False,
            )
            return JsonResponse(
                {"detail": "Authentication credentials were not provided or are invalid."},
                status=drf_status.HTTP_401_UNAUTHORIZED
            )

        # 2. Check if client IP could be determined
        if not client_ip:
            logger.error("Could not determine client IP for external API request.")
            ExternalApiAuditService.log_call(
                workspace_id=workspace_id,
                api_key_id=api_key_id,
                endpoint=request.path,
                http_method=request.method,
                status_code=drf_status.HTTP_403_FORBIDDEN, # Treat as blocked if IP cannot be determined
                request_id=request.headers.get("X-Request-ID"),
                ip_address=client_ip, # Pass ip_address
                user_agent=user_agent, # Pass user_agent
                scopes_used=scopes,
                permission_granted=False,
                metadata={"reason": "client_ip_unknown"}
            )
            return JsonResponse(
                {"detail": "Forbidden: Unable to determine client IP address."},
                status=drf_status.HTTP_403_FORBIDDEN
            )

        # 3. IP Allowlist Enforcement (Workspace/API key level)
        allowed_ips = scopes.get('config', {}).get('allowed_ips', [])
        if allowed_ips:
            if not is_ip_allowed(client_ip, allowed_ips):
                logger.warning(
                    f"IP Blocked: API Key {api_key_id} from IP {client_ip} "
                    f"not in allowlist for workspace {workspace_id}."
                )
                ExternalApiAuditService.log_call(
                    workspace_id=workspace_id,
                    api_key_id=api_key_id,
                    endpoint=request.path,
                    http_method=request.method,
                    status_code=drf_status.HTTP_403_FORBIDDEN,
                    request_id=request.headers.get("X-Request-ID"),
                    ip_address=client_ip, # Pass ip_address
                    user_agent=user_agent, # Pass user_agent
                    scopes_used=scopes,
                    permission_granted=False,
                    metadata={"reason": "ip_blocked", "client_ip": client_ip, "allowed_ips_config": allowed_ips}
                )
                return JsonResponse(
                    {"detail": "Forbidden: IP address not allowed."},
                    status=drf_status.HTTP_403_FORBIDDEN
                )

        # 4. Optional HMAC Request Signing (Enterprise)
        hmac_secret = scopes.get('config', {}).get('hmac_secret')
        
        if hmac_secret: # HMAC is enabled for this API key
            timestamp_header = request.headers.get("X-Tamm-Timestamp")
            signature_header = request.headers.get("X-Tamm-Signature")

            # Check if both HMAC headers are present if secret is configured
            if not timestamp_header or not signature_header:
                logger.warning(
                    f"HMAC Error: Missing X-Tamm-Timestamp or X-Tamm-Signature headers "
                    f"for API key {api_key_id} in workspace {workspace_id}."
                )
                ExternalApiAuditService.log_call(
                    workspace_id=workspace_id,
                    api_key_id=api_key_id,
                    endpoint=request.path,
                    http_method=request.method,
                    status_code=drf_status.HTTP_403_FORBIDDEN,
                    request_id=request.headers.get("X-Request-ID"),
                    ip_address=client_ip, # Pass ip_address
                    user_agent=user_agent, # Pass user_agent
                    scopes_used=scopes,
                    permission_granted=False,
                    metadata={"reason": "hmac_missing_headers", "client_ip": client_ip}
                )
                return JsonResponse(
                    {"detail": "Forbidden: HMAC signature required."},
                    status=drf_status.HTTP_403_FORBIDDEN
                )
            
            # Read the raw request body once for HMAC verification
            # Make sure to set request._body_read = True to prevent Django from trying to read it again
            # The body needs to be reset for Django's parser to work later IF it's not JSON already parsed
            # For idempotent operations, body might be empty, so handle that.
            request_body = request.body
            
            if not verify_hmac_signature(
                secret=hmac_secret,
                method=request.method,
                path=request.path,
                timestamp_header=timestamp_header,
                signature_header=signature_header,
                body=request_body
            ):
                logger.warning(
                    f"HMAC Error: Invalid signature or timestamp skew for API key {api_key_id} "
                    f"from IP {client_ip} in workspace {workspace_id}."
                )
                ExternalApiAuditService.log_call(
                    workspace_id=workspace_id,
                    api_key_id=api_key_id,
                    endpoint=request.path,
                    http_method=request.method,
                    status_code=drf_status.HTTP_403_FORBIDDEN,
                    request_id=request.headers.get("X-Request-ID"),
                    ip_address=client_ip, # Pass ip_address
                    user_agent=user_agent, # Pass user_agent
                    scopes_used=scopes,
                    permission_granted=False,
                    metadata={"reason": "signature_failed", "client_ip": client_ip, "timestamp": timestamp_header}
                )
                return JsonResponse(
                    {"detail": "Forbidden: Invalid HMAC signature or expired timestamp."},
                    status=drf_status.HTTP_403_FORBIDDEN
                )
        
        # 5. Attach workspace_id and scopes to request context
        request.external_api_context = RequestContext(workspace_id, api_key_id, scopes)


        # 3. Enforce Rate Limiting (Placeholder)
        # if not RateLimitService.check_rate_limit(workspace_id, api_key_id):
        #     ExternalApiAuditService.log_call(
        #         workspace_id=workspace_id,
        #         api_key_id=api_key_id,
        #         endpoint=request.path,
        #         http_method=request.method,
        #         status_code=drf_status.HTTP_429_TOO_MANY_REQUESTS,
        #         request_id=request.headers.get("X-Request-ID"),
        #         ip_address=client_ip, # Pass ip_address
        #         user_agent=user_agent, # Pass user_agent
        #         scopes_used=scopes, # Pass actual scopes used
        #         permission_granted=False,
        #     )
        #     return JsonResponse(
        #         {"detail": "Rate limit exceeded."},
        #         status=drf_status.HTTP_429_TOO_MANY_REQUESTS
        #     )

        # 4. Credits Deduction (Placeholder - to be called in views based on actual action cost)
        #    Middleware is generally not the place for *deduction* as cost depends on API action.
        #    It's more suitable for checking *available* credits if needed pre-request.
        #    Actual deduction will happen in the views.

        # Log successful authentication and proceed
        # The full audit with final status code will happen in process_response
        request._external_api_start_time = datetime.now()
        request._external_api_audited_initial = True # Mark for response logging
        return None # Continue processing the request

    def process_response(self, request, response):
        # Only process requests for the external API path that were handled by our middleware
        if not request.path.startswith("/api/v1/external/") or not hasattr(request, "_external_api_audited_initial"):
            return response

        # Ensure workspace_id and api_key_id are available
        workspace_id = getattr(request, "workspace_id", None)
        api_key_id = getattr(request, "api_key_id", None)
        request_id = request.headers.get("X-Request-ID")
        client_ip = getattr(request, "_client_ip", None) # Retrieve from request
        user_agent = getattr(request, "_user_agent", None) # Retrieve from request
        
        # Retrieve scopes_used and permission_granted from request (set by require_scope decorator)
        scopes_used = getattr(request, "_external_api_scopes_used", {})
        permission_granted = getattr(request, "_external_api_permission_granted", False)
        required_scope = getattr(request, "_external_api_required_scope", None)

        # Log the completed API call
        ExternalApiAuditService.log_call(
            workspace_id=workspace_id or uuid.UUID(str(uuid.uuid4())), # Use dummy if not resolved (shouldn't happen here)
            api_key_id=api_key_id,
            endpoint=request.path,
            http_method=request.method,
            status_code=response.status_code,
            request_id=request_id,
            ip_address=client_ip, # Pass ip_address
            user_agent=user_agent, # Pass user_agent
            scopes_used=scopes_used, # Pass scopes used
            permission_granted=permission_granted, # Pass permission outcome
        )
        return response