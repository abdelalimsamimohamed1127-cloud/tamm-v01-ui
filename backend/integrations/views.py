from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import exceptions

from core.auth import SupabaseJWTAuthentication
from core.permissions import IsWorkspaceMember, IsWorkspaceAdmin # Import IsWorkspaceAdmin
from integrations.ingest import IngestionProcessor
from integrations.serializers import ConnectorSerializer, ConnectorCreateUpdateSerializer, SyncTriggerSerializer # Import new serializers
from integrations.supabase_repo import IntegrationsSupabaseRepo

import uuid
import datetime

import logging
from core.errors import SupabaseUnavailableError

logger = logging.getLogger(__name__)

class ConnectorAPIView(APIView):
    """
    API endpoint for listing and creating external data connectors.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    
    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        """
        if self.request.method == 'GET':
            permission_classes = [IsWorkspaceMember]
        else: # POST, PUT, PATCH, DELETE
            permission_classes = [IsWorkspaceAdmin]
        return [permission() for permission in permission_classes]

    def get(self, request, *args, **kwargs):
        """
        Lists all connectors for the authenticated workspace.
        """
        workspace_id = request.workspace_id
        user_jwt = request.auth

        try:
            repo = IntegrationsSupabaseRepo(user_jwt)
            connectors = repo.list_connectors(workspace_id=workspace_id)
            serializer = ConnectorSerializer(connectors, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except SupabaseUnavailableError as e:
            logger.error(
                "Error listing connectors",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise e
        except Exception as e:
            logger.critical(
                "Unexpected error listing connectors",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException(f"Failed to list connectors: {e}")

    def post(self, request, *args, **kwargs):
        """
        Creates a new connector for the authenticated workspace.
        """
        serializer = ConnectorCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        workspace_id = request.workspace_id
        user_jwt = request.auth

        logger.info(
            "Creating connector",
            extra={
                "workspace_id": workspace_id,
                "type": serializer.validated_data.get("type"),
                "name": serializer.validated_data.get("name"),
            },
        )

        try:
            repo = IntegrationsSupabaseRepo(user_jwt)
            connector = repo.create_connector(workspace_id=workspace_id, connector_data=serializer.validated_data)
            response_serializer = ConnectorSerializer(connector) # Use full serializer for consistent output
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
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

class SyncConnectorAPIView(APIView):
    """
    API endpoint for triggering a manual sync for a specific connector.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceAdmin] # Only admins can trigger sync

    def post(self, request, connector_id, *args, **kwargs):
        workspace_id = request.workspace_id
        user_jwt = request.auth

        try:
            connector_uuid = uuid.UUID(connector_id)
        except ValueError:
            return Response({"detail": "Invalid connector ID format."}, status=status.HTTP_400_BAD_REQUEST)

        repo = IntegrationsSupabaseRepo(user_jwt)
        try:
            connector = repo.get_connector(connector_id=connector_uuid, workspace_id=workspace_id)
        except exceptions.NotFound:
            return Response({"detail": "Connector not found or not accessible."}, status=status.HTTP_404_NOT_FOUND)
        except SupabaseUnavailableError as e:
            logger.error(
                f"Error getting connector {connector_id} for sync",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise e

        logger.info(
            "Triggering connector sync",
            extra={
                "workspace_id": workspace_id,
                "connector_id": connector_id,
                "connector_type": connector.get("type"),
            },
        )

        # TODO: Replace with actual ingestion trigger (e.g., calling an Edge Function)
        # For now, simulate success and update last_sync_at
        try:
            # Placeholder for invoking external ingestion trigger
            # Example: call an Edge Function or Django background task
            # IngestionProcessor.run_ingestion(connector_uuid, workspace_id)
            
            # Simulate successful ingestion
            updated_connector = repo.update_connector_status(
                connector_id=connector_uuid,
                workspace_id=workspace_id,
                status="active", # Or 'syncing' then 'active' on completion
                last_sync_at=datetime.datetime.now()
            )
            response_serializer = ConnectorSerializer(updated_connector)
            return Response(response_serializer.data, status=status.HTTP_202_ACCEPTED) # 202 Accepted for async operation
        except SupabaseUnavailableError as e:
            logger.error(
                f"Error triggering sync for connector {connector_id}",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise e
        except Exception as e:
            logger.critical(
                f"Unexpected error triggering sync for connector {connector_id}",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            # Mark status as error if sync fails
            repo.update_connector_status(
                connector_id=connector_uuid,
                workspace_id=workspace_id,
                status="error"
            )
            raise exceptions.APIException(f"Failed to trigger sync: {e}")


# IngestAPIView is no longer needed if SyncConnectorAPIView handles the trigger.
# If IngestAPIView was for generic data ingestion rather than connector-specific sync,
# it might remain or be refactored. For this task, assuming SyncConnectorAPIView replaces the core
# "trigger ingestion" use case, thus it's removed.
# class IngestAPIView(APIView):
#     """
#     API endpoint for ingesting data via configured connectors.
#     """
#     authentication_classes = [SupabaseJWTAuthentication]
#     permission_classes = [IsWorkspaceMember]

#     def post(self, request, *args, **kwargs):
#         serializer = IngestPayloadSerializer(data=request.data)
#         serializer.is_valid(raise_exception=True)

#         connector_id = serializer.validated_data['connector_id']
#         entity_type = serializer.validated_data['entity_type']
#         payload = serializer.validated_data['payload']

#         workspace_id = request.workspace_id
#         user_jwt = request.auth

#         logger.info(
#             "Ingesting data",
#             extra={
#                 "workspace_id": workspace_id,
#                 "connector_id": connector_id,
#                 "entity_type": entity_type,
#             },
#         )

#         try:
#             processor = IngestionProcessor(user_jwt=user_jwt, workspace_id=workspace_id)
#             canonical_records = processor.process_ingestion(
#                 connector_id=connector_id,
#                 entity_type=entity_type,
#                 raw_payload=payload
#             )
#             return Response({"status": "ingested", "records_count": len(canonical_records)}, status=status.HTTP_200_OK)
#         except (exceptions.NotFound, exceptions.ValidationError, SupabaseUnavailableError) as e:
#             logger.warning(
#                 f"Error during ingestion: {e.__class__.__name__}",
#                 extra={"workspace_id": workspace_id, "connector_id": connector_id, "error": str(e)},
#             )
#             raise e
#         except Exception as e:
#             logger.critical(
#                 "Unexpected error during ingestion",
#                 extra={"workspace_id": workspace_id, "connector_id": connector_id, "error": str(e)},
#                 exc_info=True,
#             )
#             raise exceptions.APIException(f"Ingestion failed: {e}")
