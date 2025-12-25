import uuid
from typing import Optional
from rest_framework import exceptions
from billing.supabase_repo import BillingSupabaseRepo
from core.errors import SupabaseUnavailableError
import logging

logger = logging.getLogger(__name__)

class CreditEnforcer:
    """
    Enforces credit rules for workspace-level AI usage.
    """
    def __init__(self, user_jwt: str):
        self.repo = BillingSupabaseRepo(user_jwt)
    
    def check_and_deduct_ai_credit(self, workspace_id: uuid.UUID, agent_id: Optional[uuid.UUID] = None, channel: Optional[str] = None) -> bool:
        """
        Checks if a workspace has enough credits for an AI operation (1 credit per AI message).
        If so, it deducts the credit.
        
        Returns True if credit is successfully deducted, False otherwise.
        Raises PaymentRequired exception if credits are insufficient.
        """
        CREDITS_PER_AI_MESSAGE = 1

        try:
            deducted = self.repo.deduct_credits(workspace_id, CREDITS_PER_AI_MESSAGE)

            if not deducted:
                self.repo.log_usage_event(
                    workspace_id=workspace_id,
                    event_type="ai_message_blocked",
                    credits_used=0,
                    agent_id=agent_id,
                    channel=channel
                )
                raise exceptions.PaymentRequired("Insufficient credits to perform this AI operation.")
            
            self.repo.log_usage_event(
                workspace_id=workspace_id,
                event_type="ai_message",
                credits_used=CREDITS_PER_AI_MESSAGE,
                agent_id=agent_id,
                channel=channel
            )
            return True
        except SupabaseUnavailableError as e:
            logger.error(
                "Supabase error during credit deduction",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise SupabaseUnavailableError(detail="Could not process credit deduction due to a database error.")
        except exceptions.PaymentRequired:
            raise # Re-raise to be handled by the middleware
        except Exception as e:
            logger.error(
                "Unexpected error during credit deduction",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise exceptions.APIException("An unexpected error occurred during credit processing.")