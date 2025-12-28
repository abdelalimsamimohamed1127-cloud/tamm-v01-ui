import logging
from typing import Dict, Any
from uuid import UUID

from .db import automations_repo
from .registry import get_handler_for_automation
from .idempotency import check_and_set_idempotency_key

logger = logging.getLogger(__name__)

class AutomationsEngine:
    def trigger(self, event_name: str, workspace_id: UUID, payload: Dict[str, Any]):
        """
        Main entry point for the automations engine.
        This method is called by various parts of the Django app when a notable
        business event occurs.
        """
        logger.info(
            "Automations engine triggered",
            extra={"event_name": event_name, "workspace_id": workspace_id},
        )

        automations = automations_repo.get_enabled_automations_for_trigger(
            workspace_id, event_name
        )

        if not automations:
            return

        for automation in automations:
            automation_key = automation.get("key")
            automation_id = automation.get("id")
            
            # 1. Idempotency Check
            event_id = payload.get("id")
            if not event_id:
                logger.warning(
                    "Event payload is missing 'id', cannot perform idempotency check.",
                    extra={"automation_id": automation_id, "event_name": event_name},
                )
                continue

            idempotency_key = f"automation:{automation_id}:event:{event_id}"
            
            if check_and_set_idempotency_key(idempotency_key):
                logger.info("Skipping already processed event", extra={"idempotency_key": idempotency_key})
                continue

            # 2. Get the appropriate handler
            handler = get_handler_for_automation(automation_key)
            
            if not handler:
                logger.warning(
                    "No handler found for automation key",
                    extra={"automation_key": automation_key, "workspace_id": workspace_id},
                )
                continue

            # 3. Execute the handler
            try:
                logger.info(
                    "Executing automation handler",
                    extra={
                        "automation_id": automation_id,
                        "automation_key": automation_key,
                        "handler": handler.__class__.__name__,
                    },
                )
                handler.execute(automation, payload)
            except Exception as e:
                # IMPORTANT: Never let a single automation failure crash the whole pipeline.
                logger.error(
                    "Automation handler failed",
                    extra={
                        "automation_id": automation_id,
                        "automation_key": automation_key,
                        "error": str(e),
                    },
                    exc_info=True,
                )

# Global engine instance
engine = AutomationsEngine()
