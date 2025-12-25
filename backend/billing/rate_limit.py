import time
from collections import defaultdict, deque
from rest_framework import exceptions
from typing import Dict, Deque

# In-memory store for rate limits
# Structure: { 'workspace_id': { 'endpoint_name': deque([timestamp1, timestamp2]) } }
RATE_LIMIT_STORE: Dict[uuid.UUID, Dict[str, Deque[float]]] = defaultdict(lambda: defaultdict(deque))

import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    """
    Implements workspace-level rate limiting using an in-memory store.
    """
    def __init__(self, requests_per_minute: int = 60, time_window_seconds: int = 60):
        self.requests_per_minute = requests_per_minute
        self.time_window_seconds = time_window_seconds

    def _cleanup_timestamps(self, timestamps: Deque[float]):
        """Remove old timestamps outside the current window."""
        current_time = time.time()
        while timestamps and timestamps[0] <= current_time - self.time_window_seconds:
            timestamps.popleft()

    def check_and_apply_rate_limit(self, workspace_id: uuid.UUID, endpoint_name: str):
        """
        Checks if the workspace is within its rate limit for a given endpoint.
        If not, raises an API exception. If within limits, records the request.
        """
        workspace_limits = RATE_LIMIT_STORE[workspace_id]
        endpoint_timestamps = workspace_limits[endpoint_name]

        self._cleanup_timestamps(endpoint_timestamps)

        if len(endpoint_timestamps) >= self.requests_per_minute:
            reset_time = endpoint_timestamps[0] + self.time_window_seconds
            wait_time = max(0, reset_time - time.time())
            
            logger.warning(
                "Rate limit exceeded for workspace",
                extra={
                    "workspace_id": str(workspace_id),
                    "endpoint": endpoint_name,
                    "limit": self.requests_per_minute,
                },
            )
            raise exceptions.Throttled(wait=wait_time)

        endpoint_timestamps.append(time.time())
