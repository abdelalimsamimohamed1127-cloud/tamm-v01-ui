# backend/external_api/views.py

import json
import uuid
import logging
from datetime import datetime

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import status as drf_status
import redis
from django.conf import settings

from backend.external_api.auth import hash_api_key, generate_api_key
from backend.external_api.audit import ExternalApiAuditService
from backend.external_api.serializers import ExternalEventSerializer
from backend.external_api.permissions import require_scope, CANONICAL_SCOPES # Import for scopes
from django.db import connection, transaction
from psycopg2 import sql

logger = logging.getLogger(__name__)

# Initialize Redis client (consider making this a global or memoized instance for performance)
redis_client = redis.Redis.from_url(settings.REDIS_URL)

# --- Internal API Key Management Views (for Workspace Admins) ---

@csrf_exempt
@require_http_methods(["POST"])
def create_workspace_api_key(request):
    """
    Internal API to create a new API key for a workspace.
    Requires workspace_admin context.
    Returns the raw API key ONCE.
    """
    # Assuming authentication and authorization middleware has set request.workspace_id
    # and verified admin status.
    workspace_id = getattr(request, 'workspace_id', None)
    if not workspace_id:
        return JsonResponse({"detail": "Workspace context missing."}, status=drf_status.HTTP_400_BAD_REQUEST)
    # RBAC: Further ensure request.user is a workspace admin here if middleware doesn't fully cover.

    try:
        data = json.loads(request.body)
        name = data.get("name")
        requested_scopes = data.get("scopes", {}) # New: allow setting scopes

        if not name:
            return JsonResponse({"detail": "API key name is required."}, status=drf_status.HTTP_400_BAD_REQUEST)
        
        # Validate requested_scopes against CANONICAL_SCOPES
        validated_scopes = {}
        for scope_key, enabled in requested_scopes.items():
            if scope_key in CANONICAL_SCOPES and enabled is True:
                validated_scopes[scope_key] = True
        # If no scopes explicitly enabled, default to empty (no access)
        if not validated_scopes:
            validated_scopes = {} # Ensure it's an empty dict, not None for jsonb

        raw_api_key = generate_api_key()
        hashed_api_key = hash_api_key(raw_api_key)

        with connection.cursor() as cursor:
            api_key_id = uuid.uuid4()
            cursor.execute(
                sql.SQL("""
                    INSERT INTO public.workspace_api_keys (id, workspace_id, name, key_hash, status, scopes, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW());
                """),
                [str(api_key_id), str(workspace_id), name, hashed_api_key, 'active', json.dumps(validated_scopes)]
            )
        
        # Log this action (internal audit, not external_api_audit_logs)
        # AuditService.log_internal_event(...)

        return JsonResponse({
            "id": str(api_key_id),
            "name": name,
            "api_key": raw_api_key, # IMPORTANT: Raw key returned only once!
            "workspace_id": str(workspace_id),
            "status": "active",
            "scopes": validated_scopes,
        }, status=drf_status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error creating API key for workspace {workspace_id}: {e}", exc_info=True)
        return JsonResponse({"detail": "Failed to create API key."}, status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR)

@csrf_exempt
@require_http_methods(["POST"])
def revoke_workspace_api_key(request, key_id):
    """
    Internal API to revoke an API key for a workspace.
    Requires workspace_admin context.
    """
    workspace_id = getattr(request, 'workspace_id', None)
    if not workspace_id:
        return JsonResponse({"detail": "Workspace context missing."}, status=drf_status.HTTP_400_BAD_REQUEST)
    # RBAC: Further ensure request.user is a workspace admin here.

    try:
        api_key_uuid = uuid.UUID(key_id)
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("""
                    UPDATE public.workspace_api_keys
                    SET status = 'revoked', updated_at = NOW()
                    WHERE id = %s AND workspace_id = %s;
                """),
                [str(api_key_uuid), str(workspace_id)]
            )
            if cursor.rowcount == 0:
                return JsonResponse({"detail": "API key not found or not belonging to workspace."}, status=drf_status.HTTP_404_NOT_FOUND)
        
        # Log this action (internal audit)
        # AuditService.log_internal_event(...)

        return JsonResponse({"detail": f"API key {key_id} revoked."}, status=drf_status.HTTP_200_OK)
    except ValueError:
        return JsonResponse({"detail": "Invalid API key ID format."}, status=drf_status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error revoking API key {key_id} for workspace {workspace_id}: {e}", exc_info=True)
        return JsonResponse({"detail": "Failed to revoke API key."}, status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR)

@csrf_exempt
@require_http_methods(["GET"])
def list_workspace_api_keys(request):
    """
    Internal API to list API keys for a workspace.
    Requires workspace_member context.
    Does NOT return raw API keys.
    """
    workspace_id = getattr(request, 'workspace_id', None)
    if not workspace_id:
        return JsonResponse({"detail": "Workspace context missing."}, status=drf_status.HTTP_400_BAD_REQUEST)
    # RBAC: Further ensure request.user is a workspace member.

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("""
                    SELECT id, name, status, scopes, last_used_at, created_at
                    FROM public.workspace_api_keys
                    WHERE workspace_id = %s;
                """),
                [str(workspace_id)]
            )
            api_keys_data = []
            for row in cursor.fetchall():
                api_keys_data.append({
                    "id": str(row[0]),
                    "name": row[1],
                    "status": row[2],
                    "scopes": row[3], # Return scopes
                    "last_used_at": row[4].isoformat() if row[4] else None,
                    "created_at": row[5].isoformat()
                })
        return JsonResponse({"api_keys": api_keys_data}, status=drf_status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error listing API keys for workspace {workspace_id}: {e}", exc_info=True)
        return JsonResponse({"detail": "Failed to list API keys."}, status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- External API Endpoints ---

@csrf_exempt
@require_http_methods(["POST"])
@require_scope("events:write") # Apply scope enforcement
def external_events_view(request):
    """
    External API endpoint to ingest events from external systems.
    Authenticated via API key middleware.
    """
    external_api_context = getattr(request, 'external_api_context', None)
    if not external_api_context:
        # This should ideally be caught by middleware earlier
        return JsonResponse({"detail": "Authentication context missing."}, status=drf_status.HTTP_401_UNAUTHORIZED)

    workspace_id = external_api_context.workspace_id
    api_key_id = external_api_context.api_key_id
    request_id = request.headers.get("X-Request-ID")
    idempotency_key = request.headers.get("Idempotency-Key")

    if not idempotency_key:
        ExternalApiAuditService.log_call(
            workspace_id=workspace_id,
            api_key_id=api_key_id,
            endpoint=request.path,
            http_method=request.method,
            status_code=drf_status.HTTP_400_BAD_REQUEST,
            request_id=request_id,
            scopes_used=getattr(request, '_external_api_scopes_used', {}),
            permission_granted=getattr(request, '_external_api_permission_granted', False),
            metadata={"reason": "idempotency_key_missing"}
        )
        return JsonResponse(
            {"detail": "Idempotency-Key header is required for POST /events."},
            status=drf_status.HTTP_400_BAD_REQUEST
        )

    # 1. Replay Protection using Redis (short-term)
    # Key format: replay:{workspace_id}:{idempotency_key}
    # TTL: 10 minutes (600 seconds)
    replay_key = f"replay:{workspace_id}:{idempotency_key}"
    
    try:
        # Set the key only if it does not already exist (NX) and set an expiry (EX)
        # If set returns False, it means the key already existed, indicating a replay.
        if not redis_client.set(replay_key, 1, ex=600, nx=True):
            logger.warning(
                f"Replay detected: Idempotency-Key {idempotency_key} for workspace {workspace_id} "
                "already in Redis cache. Blocking request."
            )
            ExternalApiAuditService.log_call(
                workspace_id=workspace_id,
                api_key_id=api_key_id,
                endpoint=request.path,
                http_method=request.method,
                status_code=drf_status.HTTP_409_CONFLICT,
                request_id=request_id,
                scopes_used=getattr(request, '_external_api_scopes_used', {}),
                permission_granted=getattr(request, '_external_api_permission_granted', False),
                metadata={"reason": "replay_blocked", "idempotency_key": idempotency_key}
            )
            return JsonResponse(
                {"detail": "Request with this Idempotency-Key is already being processed or was recently processed."},
                status=drf_status.HTTP_409_CONFLICT
            )
    except Exception as e:
        logger.error(f"Redis error during replay protection for {replay_key}: {e}", exc_info=True)
        # Fail-safe: if Redis is down or errors, we proceed, relying on DB idempotency.
        # This aligns with "Production-safe, minimal blast radius changes"
        pass # Continue processing, DB idempotency check will still run


    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        ExternalApiAuditService.log_call(
            workspace_id=workspace_id,
            api_key_id=api_key_id,
            endpoint=request.path,
            http_method=request.method,
            status_code=drf_status.HTTP_400_BAD_REQUEST,
            request_id=request_id,
            scopes_used=getattr(request, '_external_api_scopes_used', {}),
            permission_granted=getattr(request, '_external_api_permission_granted', False),
        )
        return JsonResponse({"detail": "Invalid JSON payload."}, status=drf_status.HTTP_400_BAD_REQUEST)

    serializer = ExternalEventSerializer(data={
        "workspace_id": str(workspace_id),
        "source": "external_api", # Can be made dynamic from connector_id if needed
        "event_type": payload.get("event_type", "unknown"),
        "payload": payload,
        "idempotency_key": idempotency_key,
    })

    if not serializer.is_valid():
        ExternalApiAuditService.log_call(
            workspace_id=workspace_id,
            api_key_id=api_key_id,
            endpoint=request.path,
            http_method=request.method,
            status_code=drf_status.HTTP_400_BAD_REQUEST,
            request_id=request_id,
            scopes_used=getattr(request, '_external_api_scopes_used', {}),
            permission_granted=getattr(request, '_external_api_permission_granted', False),
        )
        return JsonResponse(serializer.errors, status=drf_status.HTTP_400_BAD_REQUEST)

    validated_data = serializer.validated_data

    # Idempotency check
    if idempotency_key:
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("""
                    SELECT id FROM public.external_events
                    WHERE workspace_id = %s AND idempotency_key = %s;
                """),
                [str(workspace_id), idempotency_key]
            )
            if cursor.fetchone():
                logger.info(
                    f"Idempotent event received for workspace {workspace_id}, idempotency_key {idempotency_key}. "
                    "Skipping duplicate insertion."
                )
                ExternalApiAuditService.log_call(
                    workspace_id=workspace_id,
                    api_key_id=api_key_id,
                    endpoint=request.path,
                    http_method=request.method,
                    status_code=drf_status.HTTP_200_OK, # Or 202 Accepted
                    request_id=request_id,
                    scopes_used=getattr(request, '_external_api_scopes_used', {}),
                    permission_granted=getattr(request, '_external_api_permission_granted', True), # Event was processed (idempotently)
                )
                return JsonResponse({"detail": "Event already processed."}, status=drf_status.HTTP_200_OK)


    try:
        with connection.cursor() as cursor:
            event_id = uuid.uuid4()
            cursor.execute(
                sql.SQL("""
                    INSERT INTO public.external_events (
                        id, workspace_id, source, event_type, payload, idempotency_key, received_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, NOW());
                """),
                [
                    str(event_id),
                    str(validated_data["workspace_id"]),
                    validated_data["source"],
                    validated_data["event_type"],
                    json.dumps(validated_data["payload"]),
                    validated_data.get("idempotency_key"),
                ]
            )
        
        ExternalApiAuditService.log_call(
            workspace_id=workspace_id,
            api_key_id=api_key_id,
            endpoint=request.path,
            http_method=request.method,
            status_code=drf_status.HTTP_201_CREATED,
            request_id=request_id,
            scopes_used=getattr(request, '_external_api_scopes_used', {}),
            permission_granted=getattr(request, '_external_api_permission_granted', True),
        )
        return JsonResponse({"detail": "Event ingested successfully.", "event_id": str(event_id)}, status=drf_status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error ingesting external event for workspace {workspace_id}: {e}", exc_info=True)
        ExternalApiAuditService.log_call(
            workspace_id=workspace_id,
            api_key_id=api_key_id,
            endpoint=request.path,
            http_method=request.method,
            status_code=drf_status.HTTP_500_INTERNAL_SERVER_ERROR,
            request_id=request_id,
            scopes_used=getattr(request, '_external_api_scopes_used', {}),
            permission_granted=getattr(request, '_external_api_permission_granted', False),
        )
        return JsonResponse({"detail": "Failed to ingest event."}, status=drf_status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@require_http_methods(["GET"])
@require_scope("status:read") # Apply scope enforcement
def external_status_view(request):
    """
    External API endpoint for a simple health check.
    Authenticated via API key middleware, scoped to workspace.
    """
    external_api_context = getattr(request, 'external_api_context', None)
    if not external_api_context:
        # This should ideally be caught by middleware earlier
        ExternalApiAuditService.log_call(
            workspace_id=uuid.UUID(str(uuid.uuid4())), # Dummy for non-authenticated
            api_key_id=None,
            endpoint=request.path,
            http_method=request.method,
            status_code=drf_status.HTTP_401_UNAUTHORIZED,
            request_id=request.headers.get("X-Request-ID"),
            scopes_used={},
            permission_granted=False,
        )
        return JsonResponse({"detail": "Authentication context missing."}, status=drf_status.HTTP_401_UNAUTHORIZED)
    
    workspace_id = external_api_context.workspace_id
    api_key_id = external_api_context.api_key_id
    request_id = request.headers.get("X-Request-ID")

    # Perform any workspace-specific health checks here if needed
    
    ExternalApiAuditService.log_call(
        workspace_id=workspace_id,
        api_key_id=api_key_id,
        endpoint=request.path,
        http_method=request.method,
        status_code=drf_status.HTTP_200_OK,
        request_id=request_id,
        scopes_used=getattr(request, '_external_api_scopes_used', {}),
        permission_granted=getattr(request, '_external_api_permission_granted', True),
    )
    return JsonResponse({"status": "ok", "workspace_id": str(workspace_id)}, status=drf_status.HTTP_200_OK)