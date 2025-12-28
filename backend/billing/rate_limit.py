import logging
import time
import redis
from django.conf import settings
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

# --- Redis Client Setup ---
# Use a connection pool for efficiency and reuse connections
try:
    REDIS_CLIENT = redis.StrictRedis.from_url(
        settings.REDIS_URL,
        decode_responses=True, # Decode Redis responses to Python strings
        socket_connect_timeout=1 # Timeout for connecting to Redis
    )
    # Ping to check connection
    REDIS_CLIENT.ping()
    logger.info("Successfully connected to Redis for rate limiting.")
except redis.exceptions.ConnectionError as e:
    REDIS_CLIENT = None
    logger.error(f"Could not connect to Redis for rate limiting. Rate limiting will be disabled. Error: {e}")
except AttributeError: # settings.REDIS_URL might not be configured
    REDIS_CLIENT = None
    logger.error("REDIS_URL not found in Django settings. Rate limiting will be disabled.")


# --- Rate Limit Configuration ---
# Example Limits: (limit, window_seconds)
RATE_LIMIT_CONFIG: Dict[str, Tuple[int, int]] = {
    "free": (60, 60),      # 60 requests per minute
    "starter": (300, 60),  # 300 requests per minute
    "pro": (2000, 60),     # 2000 requests per minute
}

# --- Helper Functions ---
def get_rate_limit(plan_key: str) -> Dict[str, int]:
    """
    Returns the rate limit configuration for a given plan key.
    Defaults to "free" plan if the plan_key is not found.
    """
    limit, window = RATE_LIMIT_CONFIG.get(plan_key, RATE_LIMIT_CONFIG["free"])
    return {"limit": limit, "window": window}

def increment_and_check(workspace_id: str, plan_key: str) -> Dict[str, Any]:
    """
    Increments the request counter for a workspace and checks if the limit is exceeded.
    Returns whether the request is allowed, the current count, and retry_after seconds.
    Fail-open: If Redis is unavailable, requests are always allowed.
    """
    if REDIS_CLIENT is None:
        logger.warning("Redis client not initialized. Skipping rate limiting.")
        return {"allowed": True, "current_count": 0, "retry_after": 0}

    limit_config = get_rate_limit(plan_key)
    limit = limit_config["limit"]
    window = limit_config["window"]

    # Use a unique key for each window, e.g., 'rate_limit:workspace_id:timestamp_bucket'
    # For a 1-minute window, we can just use the current minute.
    current_time_window = int(time.time() // window)
    key = f"rate_limit:{workspace_id}:{current_time_window}"

    try:
        # Pipeline multiple commands for atomicity and efficiency
        pipe = REDIS_CLIENT.pipeline()
        pipe.incr(key)
        pipe.ttl(key) # Get remaining TTL

        count, ttl = pipe.execute()

        # If it's the first hit in this window, set the expiry
        if count == 1:
            REDIS_CLIENT.expire(key, window)
            ttl = window # Set ttl correctly for first hit

        allowed = count <= limit
        retry_after = 0
        if not allowed:
            # If TTL is negative, key has no expiry or already expired, use window
            retry_after = ttl if ttl > 0 else window

        return {
            "allowed": allowed,
            "current_count": count,
            "retry_after": retry_after
        }
    except redis.exceptions.ConnectionError as e:
        logger.error(
            f"Redis connection error during rate limiting for workspace {workspace_id}. Request allowed. Error: {e}",
            exc_info=True,
        )
        # Fail-open: If Redis is down, allow the request
        return {"allowed": True, "current_count": 0, "retry_after": 0}
    except Exception as e:
        logger.error(
            f"Unexpected error during Redis rate limiting for workspace {workspace_id}. Request allowed. Error: {e}",
            exc_info=True,
        )
        # Fail-open for any other unexpected errors
        return {"allowed": True, "current_count": 0, "retry_after": 0}
