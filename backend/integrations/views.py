from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import exceptions

from core.auth import SupabaseJWTAuthentication
from core.permissions import IsWorkspaceMember
from integrations.ingest import IngestionProcessor, ConnectorSerializer, IngestPayloadSerializer
from integrations.supabase_repo import IntegrationsSupabaseRepo

import uuid

import logging
from core.errors import SupabaseUnavailableError

logger = logging.getLogger(__name__)

class ConnectorAPIView(APIView):
    """
    API endpoint for creating and managing external data connectors.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]

    def post(self, request, *args, **kwargs):
        serializer = ConnectorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        workspace_id = request.workspace_id
        user_jwt = request.auth

        logger.info(
            "Creating connector",
            extra={
                "workspace_id": workspace_id,
                "provider": serializer.validated_data.get("provider"),
            },
        )

        try:
            repo = IntegrationsSupabaseRepo(user_jwt)
            connector = repo.create_connector(workspace_id=workspace_id, connector_data=serializer.validated_data)
            return Response(connector, status=status.HTTP_201_CREATED)
        except SupabaseUnavailableError as e:
            logger.error(
                "Error creating connector",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise e
        except Exception as e:
            logger.critical(
                "Unexpected error creating connector",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException(f"Failed to create connector: {e}")


class IngestAPIView(APIView):
    """
    API endpoint for ingesting data via configured connectors.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]

    def post(self, request, *args, **kwargs):
        serializer = IngestPayloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        connector_id = serializer.validated_data['connector_id']
        entity_type = serializer.validated_data['entity_type']
        payload = serializer.validated_data['payload']

        workspace_id = request.workspace_id
        user_jwt = request.auth

        logger.info(
            "Ingesting data",
            extra={
                "workspace_id": workspace_id,
                "connector_id": connector_id,
                "entity_type": entity_type,
            },
        )

        try:
            processor = IngestionProcessor(user_jwt=user_jwt, workspace_id=workspace_id)
            canonical_records = processor.process_ingestion(
                connector_id=connector_id,
                entity_type=entity_type,
                raw_payload=payload
            )
            return Response({"status": "ingested", "records_count": len(canonical_records)}, status=status.HTTP_200_OK)
        except (exceptions.NotFound, exceptions.ValidationError, SupabaseUnavailableError) as e:
            logger.warning(
                f"Error during ingestion: {e.__class__.__name__}",
                extra={"workspace_id": workspace_id, "connector_id": connector_id, "error": str(e)},
            )
            raise e
        except Exception as e:
            logger.critical(
                "Unexpected error during ingestion",
                extra={"workspace_id": workspace_id, "connector_id": connector_id, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException(f"Ingestion failed: {e}")
