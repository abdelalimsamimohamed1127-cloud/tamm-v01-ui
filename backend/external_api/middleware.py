from django.utils.deprecation import MiddlewareMixin
from rest_framework import exceptions
import uuid

class ExternalAPIMiddleware(MiddlewareMixin):
    """
    Middleware to attach workspace_id and scopes to the request for
    requests authenticated via WorkspaceAPIKeyAuthentication.
    
    This is necessary because WorkspaceAPIKeyAuthentication sets these
    attributes directly on the request.user object, but other middleware
    (like BillingMiddleware) might expect them directly on the request object.
    """
    def process_request(self, request):
        if hasattr(request, 'user') and hasattr(request.user, 'workspace_id') and hasattr(request.user, 'scopes'):
            request.workspace_id = request.user.workspace_id
            request.scopes = request.user.scopes
        
        # If the request is authenticated with a Supabase JWT (e.g., /api/health),
        # WorkspaceContextMiddleware will set request.workspace_id.
        # This middleware specifically handles the API key case.
        return None # Continue processing the request
