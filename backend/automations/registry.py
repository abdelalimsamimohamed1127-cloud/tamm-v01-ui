from typing import Dict, Type
from .handlers.base import BaseAutomationHandler
from .handlers.webhook import WebhookHandler
from .handlers.notify import NotificationHandler
from .handlers.sheets import GoogleSheetsHandler

# This registry maps an automation 'key' from the database to the
# handler class that can process it.
AUTOMATION_HANDLERS: Dict[str, Type[BaseAutomationHandler]] = {
    "order_threshold_alert": NotificationHandler,
    "webhook_forward": WebhookHandler,
    "google_sheets_sync": GoogleSheetsHandler,
    "owner_whatsapp_notify": NotificationHandler,
}

# A single instance of each handler can be reused.
_handler_instances: Dict[str, BaseAutomationHandler] = {}

def get_handler_for_automation(automation_key: str) -> BaseAutomationHandler | None:
    """
    Gets a singleton instance of the handler for a given automation key.
    """
    if automation_key not in _handler_instances:
        HandlerClass = AUTOMATION_HANDLERS.get(automation_key)
        if HandlerClass:
            _handler_instances[automation_key] = HandlerClass()
    
    return _handler_instances.get(automation_key)

# This dictionary maps an event type to a list of automation keys that
# should be triggered by it. This is an optimization to avoid checking
# every single automation for every event.
EVENT_TRIGGERS: Dict[str, list[str]] = {
    "order_created": [
        "order_threshold_alert",
        "webhook_forward",
        "google_sheets_sync",
    ],
    "message_received": [
        "webhook_forward",
        "owner_whatsapp_notify",
    ],
    "conversation_handoff": [
        "owner_whatsapp_notify",
    ],
    "billing_event": [
        # No automations are triggered by billing events yet.
    ],
}
