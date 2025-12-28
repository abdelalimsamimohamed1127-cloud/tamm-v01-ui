import json
import logging
import urllib.request
from typing import Dict, Any

from .base import BaseAutomationHandler

logger = logging.getLogger(__name__)

class WebhookHandler(BaseAutomationHandler):
    """
    Handles the 'webhook_forward' automation type.
    Sends the event payload to a configured webhook URL.
    """
    TRIGGER_TYPES = ["message_received", "order_created"]

    def execute(self, automation: Dict[str, Any], payload: Dict[str, Any]):
        config = automation.get("config", {})
        if not self._validate_config(config, ["webhook_url"]):
            logger.warning(
                "Invalid config for WebhookHandler",
                extra={"automation_id": automation.get("id")},
            )
            return

        webhook_url = config["webhook_url"]
        
        try:
            req = urllib.request.Request(
                webhook_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "Tamm-Automations/1.0"},
                method="POST",
            )
            
            # Set a timeout of 5 seconds for safety
            with urllib.request.urlopen(req, timeout=5) as response:
                if 200 <= response.status < 300:
                    logger.info(
                        "Webhook executed successfully",
                        extra={
                            "automation_id": automation.get("id"),
                            "status_code": response.status,
                        },
                    )
                else:
                    logger.warning(
                        "Webhook execution returned non-success status",
                        extra={
                            "automation_id": automation.get("id"),
                            "status_code": response.status,
                            "response_body": response.read().decode("utf-8", errors="ignore"),
                        },
                    )

        except urllib.error.URLError as e:
            logger.error(
                "Webhook execution failed",
                extra={"automation_id": automation.get("id"), "url": webhook_url, "error": str(e)},
                exc_info=True,
            )
        except Exception as e:
            logger.error(
                "An unexpected error occurred in WebhookHandler",
                extra={"automation_id": automation.get("id"), "error": str(e)},
                exc_info=True,
            )

