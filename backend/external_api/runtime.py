import uuid
import json
from typing import Dict, Any, Optional

from rest_framework import exceptions

from agents.runtime import AgentRuntime # Internal agent runtime
from agents.serializers import ChatRequestSerializer # Reuse serializer for internal call

import logging
from core.errors import AIAProviderError

logger = logging.getLogger(__name__)

class ExternalAgentRuntime:
    """
    Acts as a bridge to the internal AgentRuntime for external API calls.
    """
    def __init__(self, user_id: uuid.UUID, workspace_id: uuid.UUID, user_jwt: str):
        self.workspace_id = workspace_id
        self.agent_runtime = AgentRuntime(user_id=user_id, workspace_id=workspace_id, user_jwt=user_jwt)

    def run_agent_externally(self, agent_id: uuid.UUID, external_user_id: str, message_content: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes an agent run for an external system and returns a single response.
        """
        internal_message_payload = {
            "agent_id": str(agent_id),
            "conversation_id": None,
            "channel": "external_api",
            "message": {"type": "text", "content": message_content},
            "options": {"mode": "live", "external_context": context}
        }

        serializer = ChatRequestSerializer(data=internal_message_payload)
        serializer.is_valid(raise_exception=True)

        logger.info(
            "Running agent externally",
            extra={
                "workspace_id": self.workspace_id,
                "agent_id": agent_id,
                "external_user_id": external_user_id,
            },
        )

        try:
            stream_generator = self.agent_runtime.chat_stream(
                agent_id=agent_id,
                conversation_id=serializer.validated_data.get('conversation_id'),
                channel=serializer.validated_data['channel'],
                user_message=serializer.validated_data['message'],
                options=serializer.validated_data['options']
            )

            full_response_content = []
            conversation_id = None

            for event_str in stream_generator:
                try:
                    if 'data: ' not in event_str: continue
                    event_data = json.loads(event_str.split('data: ')[1].strip())
                    
                    if event_data.get("event") == "start":
                        conversation_id = event_data.get("conversation_id")
                    elif event_data.get("event") == "token":
                        full_response_content.append(event_data.get("delta", ""))
                    elif event_data.get("event") == "error":
                        raise AIAProviderError(detail=event_data.get('message', 'Unknown AI error'))
                except (json.JSONDecodeError, IndexError) as e:
                    logger.warning(f"Malformed SSE event from agent runtime: {event_str}", exc_info=True)
                    continue

            final_response = "".join(full_response_content)

            return {
                "status": "success",
                "agent_id": str(agent_id),
                "conversation_id": str(conversation_id),
                "external_user_id": external_user_id,
                "response": {"type": "text", "content": final_response},
                "context": context
            }
        except AIAProviderError as e:
            logger.error("AIA provider error during external agent run", extra={"agent_id": agent_id, "error": str(e)}, exc_info=True)
            raise e
        except Exception as e:
            logger.critical("Unexpected error during external agent run", extra={"agent_id": agent_id, "error": str(e)}, exc_info=True)
            raise exceptions.APIException(f"Agent execution failed: {e}")
