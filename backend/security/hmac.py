# backend/security/hmac.py

import hmac
import hashlib
import time
import json
from datetime import datetime, timezone
from typing import Optional

def generate_signature_string(
    method: str,
    path: str,
    timestamp: str,
    body: Optional[bytes] = None
) -> str:
    """
    Generates the base string over which the HMAC signature will be computed.
    Format: method + path + timestamp + body_hash
    """
    body_hash = ""
    if body:
        # Use SHA256 for body hash
        body_hash = hashlib.sha256(body).hexdigest()
    
    return f"{method.upper()}{path}{timestamp}{body_hash}"

def compute_hmac_sha256(secret: str, data_string: str) -> str:
    """
    Computes the HMAC-SHA256 signature for a given data string and secret.
    Returns the hexadecimal representation of the digest.
    """
    return hmac.new(
        secret.encode('utf-8'),
        data_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

def verify_hmac_signature(
    secret: str,
    method: str,
    path: str,
    timestamp_header: str,
    signature_header: str,
    body: Optional[bytes] = None,
    max_timestamp_skew_seconds: int = 300 # 5 minutes
) -> bool:
    """
    Verifies an incoming HMAC-SHA256 signature.

    Args:
        secret: The shared secret key for HMAC computation.
        method: The HTTP method of the request.
        path: The full path of the request URL.
        timestamp_header: The value of the X-Tamm-Timestamp header (Unix timestamp in seconds).
        signature_header: The value of the X-Tamm-Signature header (HMAC-SHA256 hex digest).
        body: The raw request body as bytes.
        max_timestamp_skew_seconds: Maximum allowed difference in seconds between
                                    request timestamp and current server time.

    Returns:
        True if the signature is valid and timestamp is within acceptable skew, False otherwise.
    """
    # 1. Timestamp validation
    try:
        request_timestamp = int(timestamp_header)
        current_timestamp = int(datetime.now(timezone.utc).timestamp())
        
        if abs(current_timestamp - request_timestamp) > max_timestamp_skew_seconds:
            return False # Timestamp skew too large
    except (ValueError, TypeError):
        return False # Invalid timestamp format

    # 2. Generate the string to sign
    string_to_sign = generate_signature_string(method, path, timestamp_header, body)

    # 3. Compute expected signature
    expected_signature = compute_hmac_sha256(secret, string_to_sign)

    # 4. Compare signatures using a constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, signature_header)