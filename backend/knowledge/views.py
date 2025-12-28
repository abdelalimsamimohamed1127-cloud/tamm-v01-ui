from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import exceptions

from core.auth import SupabaseJWTAuthentication
from core.permissions import IsWorkspaceMember
from knowledge.ingest import trigger_ingestion_job # Import the new function
from knowledge.supabase_repo import KnowledgeSupabaseRepo # Renamed from SupabaseRepo

import uuid
import logging

logger = logging.getLogger(__name__)

class KnowledgeIngestView(APIView):
    """
    API endpoint to trigger knowledge ingestion for a given source.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]

    def post(self, request, *args, **kwargs):
        source_id = request.data.get('source_id')
        agent_id = request.data.get('agent_id') # Optional, but good to have context

        if not source_id:
            return Response({"detail": "source_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        user_id = request.user.user_id 
        user_jwt = request.auth
        workspace_id = request.workspace_id

        if not user_id or not user_jwt or not workspace_id:
            raise exceptions.AuthenticationFailed("Authentication or workspace context missing.")

        try:
            # Basic validation: Check if source_id exists and belongs to the workspace/agent
            repo = KnowledgeSupabaseRepo(user_jwt=user_jwt)
            source = repo.get_knowledge_source(uuid.UUID(source_id))

            if not source:
                return Response({"detail": "Knowledge source not found or not accessible."}, status=status.HTTP_404_NOT_FOUND)
            
            # Ensure the source belongs to the current workspace and optionally agent
            if str(source.get('workspace_id')) != str(workspace_id):
                return Response({"detail": "Knowledge source does not belong to this workspace."}, status=status.HTTP_403_FORBIDDEN)
            if agent_id and str(source.get('agent_id')) != str(agent_id):
                 return Response({"detail": "Knowledge source does not belong to this agent."}, status=status.HTTP_403_FORBIDDEN)

            # Trigger the ingestion job (now a function)
            # This should ideally be async/background task for long-running ingestions
            trigger_ingestion_job(
                source_id=uuid.UUID(source_id),
                agent_id=uuid.UUID(agent_id), # Ensure agent_id is passed as UUID
                workspace_id=workspace_id,
                user_jwt=user_jwt
            )
            
            # Update source status to 'processing' immediately (moved from ingest.py)
            repo.update_knowledge_source_status(uuid.UUID(source_id), "processing")


            return Response({"message": "Ingestion job triggered successfully.", "source_id": source_id}, status=status.HTTP_202_ACCEPTED)
        except ValueError:
            return Response({"detail": "Invalid UUID format for source_id or agent_id."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error triggering ingestion job: {e}", exc_info=True)
            return Response({"detail": f"Internal server error: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RetrainRequestSerializer(serializers.Serializer):
    agent_id = serializers.UUIDField()


class RetrainKnowledgeView(APIView):
    """
    API endpoint to trigger knowledge base retraining for a given agent.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]

    def post(self, request, *args, **kwargs):
        serializer = RetrainRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        agent_id = serializer.validated_data['agent_id']

        user_id = request.user.user_id 
        user_jwt = request.auth
        workspace_id = request.workspace_id

        if not user_id or not user_jwt or not workspace_id:
            raise exceptions.AuthenticationFailed("Authentication or workspace context missing.")

        repo = KnowledgeSupabaseRepo(user_jwt=user_jwt)

        try:
            # Concurrency Guard: Check for active retrain jobs for this agent
            active_job = repo.get_active_kb_job(agent_id, 'retrain') # Need to implement get_active_kb_job
            if active_job:
                return Response(
                    {"detail": f"Retrain job for agent {agent_id} is already in {active_job['status']} state.", "job_id": str(active_job['id'])},
                    status=status.HTTP_409_CONFLICT # 409 Conflict
                )
            
            # Create kb_jobs entry
            job_id = repo.create_kb_job(agent_id, 'retrain', 'queued') # Need to implement create_kb_job

            # Trigger the asynchronous retrain job in the background
            # Note: The `retrain_agent_knowledge` function itself is async.
            # Using ThreadPoolExecutor's submit returns a Future object immediately.
            # The actual async function execution might need a custom async executor or Celery/etc.
            # For simplicity, we're calling it in a thread.
            background_executor.submit(
                lambda: retrain_agent_knowledge(agent_id, workspace_id, user_jwt, job_id)
            )

            return Response({"message": "Retrain job initiated successfully.", "job_id": str(job_id)}, status=status.HTTP_202_ACCEPTED)
        except Exception as e:
            logger.error(f"Error initiating retrain job for agent {agent_id}: {e}", exc_info=True)
            return Response({"detail": f"Internal server error: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)