import hashlib
import uuid
from rest_framework import authentication
from rest_framework import exceptions
from django.conf import settings
from supabase import create_client
import os
import logging
from typing import Optional, List
from core.errors import SupabaseUnavailableError

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise exceptions.ImproperlyConfigured(
        "SUPABASE_URL and SUPABASE_ANON_KEY must be configured."
    )

class WorkspaceAPIKeyAuthentication(authentication.BaseAuthentication):
    """
    Authenticates requests using a Workspace API Key.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return None

        try:
            api_key = auth_header.split(' ')[1]
        except IndexError:
            logger.warning("Invalid API key header format.")
            raise exceptions.AuthenticationFailed('Invalid API key header. Expected "Bearer <API_KEY>".')

        if not api_key:
            return None

        api_key_hash = hashlib.sha256(api_key.encode('utf-8')).hexdigest()

        try:
            supabase_anon_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
            response = supabase_anon_client.from_("workspace_api_keys") \
                .select("id, workspace_id, scopes, revoked_at") \
                .eq("key_hash", api_key_hash) \
                .is_("revoked_at", None) \
                .single().execute()
        except Exception as e:
            logger.error(f"Supabase error during API key authentication: {e}", exc_info=True)
            raise SupabaseUnavailableError(detail=f"API key authentication failed due to a backend error.")

        if not response.data:
            logger.warning(f"Invalid or revoked API key used. Hash: {api_key_hash}")
            raise exceptions.AuthenticationFailed('Invalid or revoked API key.')

        api_key_data = response.data
        workspace_id = uuid.UUID(api_key_data['workspace_id'])
        scopes = api_key_data['scopes']
        api_key_id = uuid.UUID(api_key_data['id'])

        request.workspace_id = workspace_id
        request.scopes = scopes
        request.api_key_id = api_key_id

        class WorkspaceAuthenticatedUser:
            is_authenticated = True
            def __init__(self, workspace_id, scopes, api_key_id):
                self.id = str(workspace_id)
                self.workspace_id = workspace_id
                self.scopes = scopes
                self.api_key_id = api_key_id
            def __str__(self):
                return f"Workspace({self.id})"

        return WorkspaceAuthenticatedUser(workspace_id, scopes, api_key_id), api_key

    def authenticate_header(self, request):
        return 'Bearer realm="external-api"'


class HasAPIScope(exceptions.PermissionDenied):
    default_detail = 'You do not have permission to perform this action with the provided API key.'

class APIKeyPermission(authentication.BaseAuthentication):
    """
    A permission class that checks for specific API key scopes.
    """
    def __init__(self, required_scopes: Optional[List[str]] = None):
        self.required_scopes = required_scopes or []

    def has_permission(self, request, view):
        if not hasattr(request, 'scopes'):
            logger.error("API key scopes not found on request. WorkspaceAPIKeyAuthentication might not have run.")
            raise exceptions.AuthenticationFailed("API key scopes not found.")

        if 'superuser' in request.scopes:
            return True

        if not self.required_scopes:
            return True

        for scope in self.required_scopes:
            if scope not in request.scopes:
                logger.warning(
                    "API key missing required scope.",
                    extra={"required_scope": scope, "provided_scopes": request.scopes, "api_key_id": str(request.api_key_id)}
                )
                raise HasAPIScope(f"API key missing required scope: '{scope}'.")
        return True
    
    def authenticate(self, request):
        # This is a permission class, not an authentication class.
        # It runs after successful authentication.
        return None