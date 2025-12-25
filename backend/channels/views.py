from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import exceptions
from rest_framework import serializers

from core.auth import SupabaseJWTAuthentication
from core.permissions import IsWorkspaceMember
from channels.events import ChannelEventHandler

import uuid

# --- Serializers ---
class ChannelEventSerializer(serializers.Serializer):
    """
    Serializer for the incoming channel event (from Edge Function).
    """
    event = serializers.CharField(max_length=100)
    workspace_id = serializers.UUIDField()
    agent_id = serializers.UUIDField()
    message_id = serializers.UUIDField()
    channel = serializers.CharField(max_length=100)
    message = serializers.JSONField() # The canonical message data

class ChannelSendSerializer(serializers.Serializer):
    """
    Serializer for sending outbound messages (from UI or AI runtime).
    """
    conversation_id = serializers.UUIDField()
    agent_id = serializers.UUIDField()
    channel = serializers.CharField(max_length=100)
    external_user_id = serializers.CharField(max_length=255)
    content = serializers.CharField()
    message_type = serializers.CharField(max_length=50, default="text")


import logging
from core.errors import SupabaseUnavailableError, AIAProviderError

logger = logging.getLogger(__name__)

class ChannelEventAPIView(APIView):
    """
    API endpoint for receiving channel events from Edge Functions.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]

    def post(self, request, *args, **kwargs):
        serializer = ChannelEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        event_data = serializer.validated_data
        workspace_id = request.workspace_id
        
        logger.info(
            "Received channel event",
            extra={
                "workspace_id": workspace_id,
                "event": event_data['event'],
                "agent_id": event_data['agent_id'],
                "channel": event_data['channel'],
            },
        )

        try:
            user_id = request.user.user_id
            user_jwt = request.auth
            handler = ChannelEventHandler(user_id=user_id, workspace_id=workspace_id, user_jwt=user_jwt)
            
            if event_data['event'] == 'message_received':
                handler.handle_incoming_message(event_data)
            else:
                raise exceptions.ValidationError(f"Unknown event type: {event_data['event']}")

            return Response({"status": "event processed"}, status=status.HTTP_200_OK)
        except (SupabaseUnavailableError, AIAProviderError) as e:
            # Re-raise known errors to be handled by the custom exception handler
            raise e
        except Exception as e:
            logger.error(
                "Error processing channel event",
                extra={"workspace_id": workspace_id, "event": event_data, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException(f"An unexpected error occurred while processing the event: {e}")


class ChannelSendAPIView(APIView):
    """
    API endpoint for sending outbound messages to external channels.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]

    def post(self, request, *args, **kwargs):
        serializer = ChannelSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        send_data = serializer.validated_data
        workspace_id = request.workspace_id

        logger.info(
            "Sending outbound message",
            extra={
                "workspace_id": workspace_id,
                "conversation_id": send_data['conversation_id'],
                "agent_id": send_data['agent_id'],
                "channel": send_data['channel'],
            },
        )

        try:
            user_id = request.user.user_id 
            user_jwt = request.auth
            handler = ChannelEventHandler(user_id=user_id, workspace_id=workspace_id, user_jwt=user_jwt)
            
            handler.handle_outbound_reply(send_data)

            return Response({"status": "message sent"}, status=status.HTTP_200_OK)
        except (SupabaseUnavailableError, AIAProviderError) as e:
            raise e
        except Exception as e:
            logger.error(
                "Error sending outbound message",
                extra={"workspace_id": workspace_id, "send_data": send_data, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException(f"An unexpected error occurred while sending the message: {e}")

