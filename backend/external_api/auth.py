# backend/external_api/auth.py

import os
import hashlib
import binascii
import uuid
import logging
from typing import Optional, Tuple

from django.conf import settings
from django.db import connection
from psycopg2 import sql

logger = logging.getLogger(__name__)

# --- API Key Hashing ---
def hash_api_key(api_key: str) -> str:
    """Hashes an API key using SHA256."""
    # A more robust solution might use bcrypt for password-like hashing,
    # but SHA256 is simpler for direct comparison as specified in notes.
    # If using bcrypt, ensure key generation process handles length.
    return hashlib.sha256(api_key.encode('utf-8')).hexdigest()

def generate_api_key() -> str:
    """Generates a random API key."""
    return binascii.hexlify(os.urandom(24)).decode() # 48 character hex string

# --- API Key Authentication ---
def get_api_key_and_workspace(
    api_key_header: str
) -> Optional[Tuple[uuid.UUID, uuid.UUID, Dict[str, bool]]]: # Added Dict[str, bool] for scopes
    """
    Validates an incoming API key from the Authorization header
    and returns its associated (api_key_id, workspace_id, scopes) if valid and active.
    """
    if not api_key_header or not api_key_header.startswith("Bearer "):
        return None

    incoming_api_key = api_key_header.split("Bearer ")[1].strip()
    if not incoming_api_key:
        return None

    hashed_incoming_key = hash_api_key(incoming_api_key)

    try:
        with connection.cursor() as cursor:
            # Select scopes along with other details
            cursor.execute(
                sql.SQL("""
                    SELECT id, workspace_id, status, scopes
                    FROM public.workspace_api_keys
                    WHERE key_hash = %s;
                """),
                [hashed_incoming_key]
            )
            result = cursor.fetchone()

            if not result:
                logger.warning("Attempted authentication with non-existent API key hash.")
                return None

            api_key_id, workspace_id, status, scopes_jsonb = result
            if status != 'active':
                logger.warning(
                    f"Attempted authentication with inactive API key {api_key_id} "
                    f"(status: {status}) for workspace {workspace_id}."
                )
                return None
            
            # Update last_used_at
            cursor.execute(
                sql.SQL("""
                    UPDATE public.workspace_api_keys
                    SET last_used_at = NOW()
                    WHERE id = %s;
                """),
                [str(api_key_id)]
            )

            # Parse scopes from JSONB, default to empty dict if NULL or invalid
            scopes = scopes_jsonb if isinstance(scopes_jsonb, dict) else {}
            
            return uuid.UUID(api_key_id), uuid.UUID(workspace_id), scopes

    except Exception as e:
        logger.error(f"Error during API key authentication: {e}", exc_info=True)
        return None

