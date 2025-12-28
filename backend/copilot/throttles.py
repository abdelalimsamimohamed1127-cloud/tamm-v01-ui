# backend/copilot/throttles.py

from rest_framework.throttling import UserRateThrottle

class CopilotChatThrottle(UserRateThrottle):
    """
    Custom rate throttle for the Copilot chat endpoint.
    Allows different rates for different user tiers (e.g., free vs paid).
    """
    scope = 'copilot_chat'

    def allow_request(self, request, view):
        # Retrieve the workspace's plan from the request, assuming it's been
        # attached by previous middleware or authentication.
        # This requires the CopilotRuntime to have fetched the plan.
        # For now, we'll assume a default or fetch it here if necessary.
        
        # This is a placeholder for dynamic rate limiting based on plan.
        # The actual rate limit (e.g., '10/minute', '100/day') would be
        # configured in settings.py under REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
        
        # For initial implementation, we'll use a simple user-based throttle.
        # More complex logic (e.g., checking request.workspace_plan) will be added
        # if the throttle needs to be dynamic based on plan.
        
        # For now, let's allow 20 requests per minute per user for all users.
        # This can be overridden by settings.py
        self.rate = '20/minute' 
        return super().allow_request(request, view)
