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

class AgentRunAPIView(APIView):
    """
    API endpoint for running an AI agent in the playground with streaming responses.
    This endpoint is designed for the Agent Playground UI.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]

    def post(self, request, *args, **kwargs):
        serializer = AgentRunRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        agent_id = serializer.validated_data['agent_id']
        message_content = serializer.validated_data['message']
        session_id = serializer.validated_data.get('session_id')
        mode = serializer.validated_data.get('mode', 'test') # Default to 'test'

        user_id = request.user.user_id 
        user_jwt = request.auth

        if not user_id or not user_jwt:
            raise exceptions.AuthenticationFailed("User ID or JWT not found after authentication.")

        workspace_id = request.workspace_id

        logger.info(
            "Initiating agent run from playground",
            extra={
                "agent_id": agent_id,
                "session_id": session_id,
                "mode": mode,
                "user_id": user_id,
                "workspace_id": workspace_id,
            },
        )

        def stream_generator():
            # Create a unique session ID if not provided, specific to playground runs
            current_session_id = session_id if session_id else str(uuid.uuid4())
            
            try:
                # Yield initial session event
                yield f"event: session\ndata: {json.dumps({'session_id': current_session_id})}\n\n"

                # AgentRuntime will handle loading agent config, session resolution,
                # calling AI, streaming tokens, and persistence.
                runtime = AgentRuntime(user_id=user_id, workspace_id=workspace_id, user_jwt=user_jwt)
                
                for event_data in runtime.playground_run_stream( # Assuming runtime yields dicts like {'type': 'token', 'content': 'partial'}
                    agent_id=agent_id,
                    session_id=current_session_id,
                    user_message=message_content,
                    mode=mode
                ):
                    # Frontend SSE Contract: event: type\ndata: {json.dumps(payload)}\n\n
                    if 'type' in event_data and event_data['type'] in ['token', 'end', 'error']:
                        yield f"event: {event_data['type']}\ndata: {json.dumps(event_data)}\n\n"
                    else:
                        logger.warning(
                            "Unknown event type from playground_run_stream",
                            extra={"event_data": event_data, "agent_id": agent_id, "session_id": current_session_id},
                        )

            except Exception as e:
                logger.error(
                    "Error during agent playground run stream",
                    extra={
                        "error": str(e),
                        "agent_id": agent_id,
                        "session_id": current_session_id,
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


class AgentTemplateListView(APIView):
    """
    API endpoint for listing agent templates.
    Accessible to any authenticated user.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    # No permission_classes required here as templates are global and readable by authenticated users
    # as per RLS policy (read -> all authenticated). Backend will still require authentication.

    def get(self, request, *args, **kwargs):
        user_id = request.user.user_id 
        user_jwt = request.auth

        if not user_id or not user_jwt:
            raise exceptions.AuthenticationFailed("User ID or JWT not found after authentication.")
        
        try:
            repo = SupabaseRepo(user_jwt=user_jwt)
            templates = repo.fetch_agent_templates()
            serializer = AgentTemplateSerializer(templates, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching agent templates: {e}", exc_info=True)
            return Response(
                {"detail": "Failed to fetch agent templates."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AgentTemplateListView(APIView):
    """
    API endpoint for listing agent templates.
    Accessible to any authenticated user.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    # No permission_classes required here as templates are global and readable by authenticated users
    # as per RLS policy (read -> all authenticated). Backend will still require authentication.

    def get(self, request, *args, **kwargs):
        user_id = request.user.user_id 
        user_jwt = request.auth

        if not user_id or not user_jwt:
            raise exceptions.AuthenticationFailed("User ID or JWT not found after authentication.")
        
        try:
            repo = SupabaseRepo(user_jwt=user_jwt)
            templates = repo.fetch_agent_templates()
            serializer = AgentTemplateSerializer(templates, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching agent templates: {e}", exc_info=True)
            return Response(
                {"detail": "Failed to fetch agent templates."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

