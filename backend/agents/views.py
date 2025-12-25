from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import exceptions
from django.http import StreamingHttpResponse

from core.auth import SupabaseJWTAuthentication
from core.permissions import IsWorkspaceMember
from agents.serializers import ChatRequestSerializer
from agents.runtime import AgentRuntime
from core.errors import AIAProviderError

import uuid
import json
import logging

logger = logging.getLogger(__name__)

# --- Helper for SSE Streaming ---
# Django's StreamingHttpResponse expects an iterator that yields strings.
# Each string should be a complete SSE event (data, event, id, retry).
class EventStream(StreamingHttpResponse):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault('content_type', 'text/event-stream')
        kwargs.setdefault('status', 200)
        super().__init__(*args, **kwargs)


class ChatAPIView(APIView):
    """
    API endpoint for handling AI agent chat interactions with streaming responses.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember] # IsAuthenticated is implied by SupabaseJWTAuthentication

    def post(self, request, *args, **kwargs):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        agent_id = serializer.validated_data['agent_id']
        conversation_id = serializer.validated_data.get('conversation_id')
        channel = serializer.validated_data['channel']
        message = serializer.validated_data['message']
        options = serializer.validated_data.get('options', {})

        user_id = request.user.user_id 
        user_jwt = request.auth

        if not user_id or not user_jwt:
            raise exceptions.AuthenticationFailed("User ID or JWT not found after authentication.")

        workspace_id = request.workspace_id

        logger.info(
            "Initiating agent chat",
            extra={
                "agent_id": agent_id,
                "conversation_id": conversation_id,
                "channel": channel,
                "user_id": user_id,
                "workspace_id": workspace_id,
            },
        )

        def stream_generator():
            try:
                runtime = AgentRuntime(user_id=user_id, workspace_id=workspace_id, user_jwt=user_jwt)
                for event in runtime.chat_stream(
                    agent_id=agent_id,
                    conversation_id=conversation_id,
                    channel=channel,
                    user_message=message,
                    options=options
                ):
                    yield event
            except Exception as e:
                logger.error(
                    "Error during agent chat stream",
                    extra={
                        "error": str(e),
                        "agent_id": agent_id,
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                        "workspace_id": workspace_id,
                    },
                    exc_info=True,
                )
                error_data = {
                    "message": "An unexpected error occurred during the stream.",
                    "code": "STREAM_ERROR"
                }
                if isinstance(e, (AIAProviderError, exceptions.APIException)):
                    error_data["message"] = e.detail
                    error_data["code"] = e.default_code if hasattr(e, 'default_code') else 'STREAM_ERROR'
                
                yield f"event: error\ndata: {json.dumps(error_data)}\n\n"

        return EventStream(stream_generator())
