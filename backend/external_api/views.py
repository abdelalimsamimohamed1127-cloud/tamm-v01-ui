from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import exceptions
from rest_framework import serializers

from core.permissions import IsWorkspaceMember # Reuse for general workspace permissions
from external_api.auth import WorkspaceAPIKeyAuthentication, APIKeyPermission # New auth and permission
from external_api.supabase_repo import ExternalApiSupabaseRepo # For audit logging
from external_api.runtime import ExternalAgentRuntime
from external_api.events import ExternalEventHandler
from external_api.ingest import ExternalDataIngestor
from integrations.serializers import ConnectorSerializer, IngestPayloadSerializer # Re-use serializers
from agents.serializers import ChatRequestSerializer # Re-use for agent run validation

import uuid


# --- Serializers ---
class ExternalAgentRunSerializer(serializers.Serializer):
    """
    Serializer for the external agent run request.
    """
    agent_id = serializers.UUIDField()
    external_user_id = serializers.CharField(max_length=255)
    message = serializers.CharField(max_length=1000)
    context = serializers.JSONField(required=False, default=dict)


class ExternalEventPayloadSerializer(serializers.Serializer):
    """
    Serializer for the external event ingestion request.
    """
    event_type = serializers.CharField(max_length=100)
    payload = serializers.JSONField()


import logging

logger = logging.getLogger(__name__)

class ExternalAgentRunAPIView(APIView):
    """
    API endpoint for external systems to trigger AI agent runs.
    """
    authentication_classes = [WorkspaceAPIKeyAuthentication]
    permission_classes = [IsWorkspaceMember, APIKeyPermission(required_scopes=['agent_run'])]

    def post(self, request, *args, **kwargs):
        audit_repo = ExternalApiSupabaseRepo()
        request_payload_summary = {"agent_id": request.data.get("agent_id"), "external_user_id": request.data.get("external_user_id")}
        response_data = {}
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        workspace_id = request.workspace_id
        api_key_id = request.api_key_id

        logger.info(
            "External agent run request received",
            extra={
                "workspace_id": workspace_id,
                "api_key_id": api_key_id,
                "agent_id": request.data.get("agent_id"),
            },
        )

        try:
            serializer = ExternalAgentRunSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            agent_id = serializer.validated_data['agent_id']
            external_user_id = serializer.validated_data['external_user_id']
            message = serializer.validated_data['message']
            context = serializer.validated_data['context']
            
            internal_user_id = api_key_id 
            user_jwt = request.auth 

            runtime = ExternalAgentRuntime(user_id=internal_user_id, workspace_id=workspace_id, user_jwt=user_jwt)
            ai_response = runtime.run_agent_externally(
                agent_id=agent_id,
                external_user_id=external_user_id,
                message_content=message,
                context=context
            )
            response_data = ai_response
            status_code = status.HTTP_200_OK
            return Response(ai_response, status=status_code)
        except exceptions.APIException as e:
            response_data = {"detail": e.detail, "code": e.default_code}
            status_code = e.status_code
            logger.warning(
                f"API Exception during external agent run: {e.detail}",
                extra={"workspace_id": workspace_id, "api_key_id": api_key_id, "error": str(e)}
            )
            raise e
        except Exception as e:
            response_data = {"detail": f"An unexpected error occurred: {e}"}
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            logger.error(
                "Unexpected error during external agent run",
                extra={"workspace_id": workspace_id, "api_key_id": api_key_id, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException(f"Internal server error: {e}")
        finally:
            audit_repo.log_api_call_audit(
                workspace_id=workspace_id,
                api_key_id=api_key_id,
                endpoint=request.path,
                status_code=status_code,
                request_payload_summary=request_payload_summary,
                response_summary=response_data
            )


class ExternalEventsAPIView(APIView):
    """
    API endpoint for external systems to emit events into Tamm.
    """
    authentication_classes = [WorkspaceAPIKeyAuthentication]
    permission_classes = [IsWorkspaceMember, APIKeyPermission(required_scopes=['event_ingest'])]

    def post(self, request, *args, **kwargs):
        audit_repo = ExternalApiSupabaseRepo()
        request_payload_summary = {"event_type": request.data.get("event_type")}
        response_data = {}
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        workspace_id = request.workspace_id
        api_key_id = request.api_key_id

        logger.info(
            "External event received",
            extra={
                "workspace_id": workspace_id,
                "api_key_id": api_key_id,
                "event_type": request.data.get("event_type"),
            },
        )

        try:
            serializer = ExternalEventPayloadSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            event_type = serializer.validated_data['event_type']
            payload = serializer.validated_data['payload']

            handler = ExternalEventHandler(workspace_id=workspace_id, api_key_id=api_key_id)
            event_id = handler.process_external_event(event_type=event_type, payload=payload)
            
            response_data = {"status": "event received", "event_id": str(event_id)}
            status_code = status.HTTP_202_ACCEPTED
            return Response(response_data, status=status_code)
        except exceptions.APIException as e:
            response_data = {"detail": e.detail, "code": e.default_code}
            status_code = e.status_code
            logger.warning(
                f"API Exception during external event processing: {e.detail}",
                extra={"workspace_id": workspace_id, "api_key_id": api_key_id, "error": str(e)}
            )
            raise e
        except Exception as e:
            response_data = {"detail": f"An unexpected error occurred: {e}"}
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            logger.error(
                "Unexpected error during external event processing",
                extra={"workspace_id": workspace_id, "api_key_id": api_key_id, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException(f"Internal server error: {e}")
        finally:
            audit_repo.log_api_call_audit(
                workspace_id=workspace_id,
                api_key_id=api_key_id,
                endpoint=request.path,
                status_code=status_code,
                request_payload_summary=request_payload_summary,
                response_summary=response_data
            )


class ExternalDataIngestAPIView(APIView):
    """
    API endpoint for external systems to ingest data for agent training.
    """
    authentication_classes = [WorkspaceAPIKeyAuthentication]
    permission_classes = [IsWorkspaceMember, APIKeyPermission(required_scopes=['data_ingest'])]

    def post(self, request, *args, **kwargs):
        audit_repo = ExternalApiSupabaseRepo()
        request_payload_summary = {"connector_id": request.data.get("connector_id"), "entity_type": request.data.get("entity_type")}
        response_data = {}
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        workspace_id = request.workspace_id
        api_key_id = request.api_key_id

        logger.info(
            "External data ingest request received",
            extra={
                "workspace_id": workspace_id,
                "api_key_id": api_key_id,
                "connector_id": request.data.get("connector_id"),
                "entity_type": request.data.get("entity_type"),
            },
        )

        try:
            serializer = IngestPayloadSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            connector_id = serializer.validated_data['connector_id']
            entity_type = serializer.validated_data['entity_type']
            payload = serializer.validated_data['payload']
            
            user_jwt = request.auth 

            ingestor = ExternalDataIngestor(
                workspace_id=workspace_id,
                api_key_id=api_key_id,
                user_jwt=user_jwt
            )
            ingestion_result = ingestor.ingest_data(
                connector_id=connector_id,
                entity_type=entity_type,
                raw_payload=payload
            )
            response_data = ingestion_result
            status_code = status.HTTP_200_OK
            return Response(response_data, status=status_code)
        except (exceptions.NotFound, exceptions.ValidationError, exceptions.APIException) as e:
            response_data = {"detail": e.detail, "code": getattr(e, 'default_code', 'error')}
            status_code = e.status_code
            logger.warning(
                f"API Exception during data ingest: {e.detail}",
                extra={"workspace_id": workspace_id, "api_key_id": api_key_id, "error": str(e)}
            )
            raise e
        except Exception as e:
            response_data = {"detail": f"An unexpected error occurred: {e}"}
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            logger.error(
                "Unexpected error during data ingest",
                extra={"workspace_id": workspace_id, "api_key_id": api_key_id, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException(f"Internal server error: {e}")
        finally:
            audit_repo.log_api_call_audit(
                workspace_id=workspace_id,
                api_key_id=api_key_id,
                endpoint=request.path,
                status_code=status_code,
                request_payload_summary=request_payload_summary,
                response_summary=response_data
            )
