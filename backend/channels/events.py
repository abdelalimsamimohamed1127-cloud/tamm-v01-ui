import uuid
from typing import Dict, Any
import json

from rest_framework import exceptions

from channels.supabase_repo import ChannelsSupabaseRepo
from channels.router import ChannelRouter
from channels.sender import ChannelSender
from agents.runtime import AgentRuntime  # Import the AgentRuntime from Stage 2


import logging
from core.errors import AIAProviderError, SupabaseUnavailableError

logger = logging.getLogger(__name__)

class ChannelEventHandler:
    """
    Handles incoming events from external channels.
    """
    def __init__(self, user_id: uuid.UUID, workspace_id: uuid.UUID, user_jwt: str):
        self.user_id = user_id
        self.workspace_id = workspace_id
        self.user_jwt = user_jwt
        self.repo = ChannelsSupabaseRepo(user_jwt)
        self.router = ChannelRouter(user_jwt)
        self.sender = ChannelSender(user_jwt)
        self.agent_runtime = AgentRuntime(user_id=user_id, workspace_id=workspace_id, user_jwt=user_jwt)

    def handle_incoming_message(self, message_data: Dict[str, Any]):
        """
        Processes an incoming message event.
        """
        agent_id = uuid.UUID(message_data["agent_id"])
        channel = message_data["channel"]
        message_id = uuid.UUID(message_data["message_id"])
        external_user_id = message_data["external_user_id"]
        message_content = message_data["message"].get("content", "")

        logger.info(
            "Handling incoming message",
            extra={
                "workspace_id": self.workspace_id,
                "agent_id": agent_id,
                "channel": channel,
                "message_id": message_id,
            },
        )
        
        try:
            chat_request_payload = {
                "agent_id": str(agent_id),
                "conversation_id": None,
                "channel": channel,
                "message": {"type": "text", "content": message_content},
                "options": {"mode": "live"}
            }

            full_assistant_response = []
            conversation_id = None

            for event_str in self.agent_runtime.chat_stream(
                agent_id=agent_id,
                conversation_id=chat_request_payload["conversation_id"],
                channel=channel,
                user_message=chat_request_payload["message"],
                options=chat_request_payload["options"]
            ):
                if 'data: ' in event_str:
                    try:
                        event_data = json.loads(event_str.split('data: ')[1].strip())
                        if 'conversation_id' in event_data and not conversation_id:
                            conversation_id = uuid.UUID(event_data['conversation_id'])
                        
                        if event_data.get('delta'):
                            full_assistant_response.append(event_data['delta'])
                        elif event_data.get('code'): # Error event from stream
                            raise AIAProviderError(detail=event_data.get('message', 'AI stream error'))
                    except json.JSONDecodeError:
                        logger.warning(f"Could not decode SSE event: {event_str}")
                        continue

            if full_assistant_response:
                assistant_text = "".join(full_assistant_response)
                self.sender.send_message(
                    workspace_id=self.workspace_id,
                    agent_id=agent_id,
                    channel=channel,
                    external_user_id=external_user_id,
                    content=assistant_text
                )
        except (AIAProviderError, SupabaseUnavailableError) as e:
            logger.error(
                "Error handling incoming message",
                extra={"message_id": message_id, "error": str(e)},
                exc_info=True,
            )
            if conversation_id:
                self.repo.update_conversation_status(conversation_id, "needs_human")
            raise e
        except Exception as e:
            logger.critical(
                "Unhandled error in ChannelEventHandler",
                extra={"message_id": message_id, "error": str(e)},
                exc_info=True,
            )
            if conversation_id:
                self.repo.update_conversation_status(conversation_id, "needs_human")
            raise exceptions.APIException("An unexpected error occurred while handling the message.")


    def handle_outbound_reply(self, reply_data: Dict[str, Any]):
        """
        Handles an outbound reply from a human (e.g., from Inbox UI).
        """
        conversation_id = uuid.UUID(reply_data["conversation_id"])
        logger.info(
            "Handling outbound reply",
            extra={
                "workspace_id": self.workspace_id,
                "conversation_id": conversation_id,
                "channel": reply_data["channel"],
            },
        )
        try:
            agent_id = uuid.UUID(reply_data["agent_id"])
            channel = reply_data["channel"]
            external_user_id = reply_data["external_user_id"]
            content = reply_data["content"]

            self.sender.send_message(
                workspace_id=self.workspace_id,
                agent_id=agent_id,
                channel=channel,
                external_user_id=external_user_id,
                content=content
            )
            self.repo.update_conversation_status(conversation_id, "human_active")
        except SupabaseUnavailableError as e:
            logger.error(
                "Error during outbound reply",
                extra={"conversation_id": conversation_id, "error": str(e)},
                exc_info=True,
            )
            raise e
        except Exception as e:
            logger.critical(
                "Unhandled error in handle_outbound_reply",
                extra={"conversation_id": conversation_id, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException("An unexpected error occurred while sending the reply.")

