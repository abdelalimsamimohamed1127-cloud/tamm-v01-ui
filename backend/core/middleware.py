from django.db import connection
from django.conf import settings
from rest_framework import exceptions

class WorkspaceContextMiddleware:
    """
    Middleware to resolve workspace context and enforce membership.

    Expects `request.user_id_from_jwt` to be set by the authentication backend
    and 'X-Workspace-ID' header to be present.

    Attaches `user_id` and `workspace_id` to the request object.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        return response

    def process_view(self, request, view_func, view_args, view_kwargs):
        # Only process if user is authenticated via Supabase JWT
        # and has a user_id from the JWT.
        if not hasattr(request, 'user_id_from_jwt') or not request.user_id_from_jwt:
            # If not authenticated, let the authentication classes handle it
            return None

        workspace_id = request.headers.get('X-Workspace-ID')

        if not workspace_id:
            raise exceptions.PermissionDenied("X-Workspace-ID header is required.")

        user_id = request.user_id_from_jwt

        # Validate workspace membership using raw SQL
        # We assume Supabase's Postgres is accessible with the default database connection
        try:
            with connection.cursor() as cursor:
                # IMPORTANT: Use parameterized query to prevent SQL injection
                cursor.execute(
                    """
                    SELECT 1
                    FROM public.workspace_members
                    WHERE user_id = %s
                    AND workspace_id = %s;
                    """,
                    [str(user_id), str(workspace_id)] # UUIDs often need to be cast to str
                )
                is_member = cursor.fetchone() is not None
        except Exception as e:
            # Log the error but don't expose sensitive DB info in production
            print(f"Database error during workspace membership check: {e}")
            raise exceptions.APIException("Could not verify workspace membership due to a database error.")


        if not is_member:
            raise exceptions.PermissionDenied("You are not a member of this workspace.")

        # Attach user_id and workspace_id to request for views/permissions
        request.user_id = user_id
        request.workspace_id = workspace_id

        return None # Continue processing the request
