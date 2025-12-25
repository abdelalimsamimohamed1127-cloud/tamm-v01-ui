from rest_framework import permissions

class IsWorkspaceMember(permissions.BasePermission):
    """
    Custom permission to only allow workspace members to access a view.
    Assumes WorkspaceContextMiddleware has already attached user_id and workspace_id to the request.
    """

    def has_permission(self, request, view):
        # Check if user_id and workspace_id are attached to the request by the middleware
        return bool(request.user and request.user.is_authenticated and
                    hasattr(request, 'user_id') and hasattr(request, 'workspace_id'))

    def has_object_permission(self, request, view, obj):
        # Object-level permissions are not required for this stage but included for completeness
        # This would typically check if the object's workspace_id matches request.workspace_id
        return True # Placeholder for now
