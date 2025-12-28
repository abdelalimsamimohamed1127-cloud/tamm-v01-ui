from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import exceptions

from core.auth import SupabaseJWTAuthentication
from core.permissions import IsWorkspaceMember
from copilot.serializers import CopilotChatRequestSerializer
from copilot.runtime import CopilotRuntime

import uuid

import logging
from core.errors import AIAProviderError
from rest_framework import exceptions

logger = logging.getLogger(__name__)

class CopilotInsightsChatAPIView(APIView):
    """
    API endpoint for the Analytical AI Copilot chat.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]
    throttle_classes = [CopilotChatThrottle] # Apply the custom throttle

    def post(self, request, *args, **kwargs):
        serializer = CopilotChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data['question']
        context = serializer.validated_data.get('context', {})

        workspace_id = request.workspace_id
        user_jwt = request.auth

        logger.info(
            "Copilot chat request received",
            extra={
                "workspace_id": workspace_id,
                "question": question,
            },
        )
        
        try:
            copilot_runtime = CopilotRuntime(user_jwt=user_jwt, workspace_id=workspace_id)
            
            insight_response = copilot_runtime.chat_with_copilot(
                question=question,
                raw_context=context
            )
            
            return Response(insight_response, status=status.HTTP_200_OK)
        except AIAProviderError as e:
            logger.error(
                "AIA provider error in Copilot chat",
                extra={"workspace_id": workspace_id, "question": question, "error": str(e)},
                exc_info=True,
            )
            raise e
        except Exception as e:
            logger.error(
                "Unexpected error in Copilot chat",
                extra={"workspace_id": workspace_id, "question": question, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException("An unexpected error occurred while processing your request.")
