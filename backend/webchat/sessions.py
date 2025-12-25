# backend/webchat/sessions.py
import uuid
from typing import Dict, Any, Optional

from .supabase_repo import WebchatSupabaseRepo

class WebchatSessionManager:
    """
    Manages the lifecycle of webchat sessions.
    - Creates new sessions.
    - Retrieves existing sessions.
    - Handles session expiry (conceptual).
    """

    def __init__(self, repo: WebchatSupabaseRepo):
        self.repo = repo

    def get_or_create_session(self, 
                              agent_id: uuid.UUID, 
                              workspace_id: uuid.UUID,
                              session_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves an existing webchat session or creates a new one.

        A session is uniquely identified by a session_id.
        If no session_id is provided, a new one is created.
        """
        if session_id:
            session = self.repo.get_session(session_id=session_id, agent_id=agent_id)
            if session:
                # Optional: Add logic here to check if the session is expired.
                # For now, we assume sessions don't expire within a reasonable timeframe.
                return session

        # If no session or session not found, create a new one.
        new_session_id = str(uuid.uuid4())
        external_user_id = f"webchat-user-{new_session_id}" # Generate a stable user ID for this session

        session_data = {
            "id": new_session_id,
            "workspace_id": workspace_id,
            "agent_id": agent_id,
            "channel": "webchat",
            "external_user_id": external_user_id,
            # Metadata can include initial referrer, user agent, etc.
            "metadata": {"source": "new_session_creation"} 
        }

        created_session = self.repo.create_session(session_data)
        return created_session