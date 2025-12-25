import uuid
from typing import Dict, Any, Literal
from channels.supabase_repo import ChannelsSupabaseRepo
from rest_framework import exceptions

import logging
from core.errors import SupabaseUnavailableError

logger = logging.getLogger(__name__)

class ChannelRouter:
    """
    Decides whether an incoming message should be handled by AI or routed for human attention.
    """
    def __init__(self, user_jwt: str):
        self.repo = ChannelsSupabaseRepo(user_jwt)

    def route_message_for_ai(self, workspace_id: uuid.UUID, agent_id: uuid.UUID, conversation_id: uuid.UUID) -> Literal["ai", "human_handoff", "skip"]:
        """
        Determines the routing for a message based on agent settings and conversation status.
        """
        try:
            agent_settings = self.repo.fetch_agent_handoff_settings(agent_id, workspace_id)
            ai_enabled = agent_settings.get("ai_enabled", True)
            handoff_mode = agent_settings.get("handoff_mode", "auto")

            logger.info(
                "Routing message",
                extra={
                    "workspace_id": workspace_id,
                    "agent_id": agent_id,
                    "conversation_id": conversation_id,
                    "ai_enabled": ai_enabled,
                    "handoff_mode": handoff_mode,
                },
            )

            if not ai_enabled:
                return "human_handoff"

            if handoff_mode == "off":
                return "ai"
            elif handoff_mode == "manual":
                return "ai"
            elif handoff_mode == "auto":
                return "ai"
            
            return "ai"

        except exceptions.NotFound:
            logger.warning(
                "Agent settings not found for routing, defaulting to AI",
                extra={"agent_id": agent_id, "workspace_id": workspace_id},
            )
            return "ai"
        except Exception as e:
            logger.error(
                "Error during channel routing",
                extra={"agent_id": agent_id, "workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise SupabaseUnavailableError(detail=f"Could not determine route due to a database error: {e}")

