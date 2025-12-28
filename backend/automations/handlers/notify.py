import logging
from typing import Dict, Any

from .base import BaseAutomationHandler

logger = logging.getLogger(__name__)

class NotificationHandler(BaseAutomationHandler):
    """
    Handles notification-based automations like 'order_threshold_alert' and 'owner_whatsapp_notify'.
    """

    def execute(self, automation: Dict[str, Any], payload: Dict[str, Any]):
        automation_key = automation.get("key")
        
        if automation_key == "order_threshold_alert":
            self._handle_order_threshold_alert(automation, payload)
        elif automation_key == "owner_whatsapp_notify":
            self._handle_owner_whatsapp_notify(automation, payload)
        else:
            logger.warning(f"Unknown notification type: {automation_key}")

    def _handle_order_threshold_alert(self, automation: Dict[str, Any], payload: Dict[str, Any]):
        config = automation.get("config", {})
        if not self._validate_config(config, ["threshold_amount"]):
            logger.warning("Invalid config for order_threshold_alert", extra={"automation_id": automation.get("id")})
            return

        # Condition: order.amount >= config.threshold_amount
        order_amount = payload.get("amount", 0)
        threshold = config["threshold_amount"]
        
        if order_amount >= threshold:
            message = f"High-value order detected! Order #{payload.get('id')} for ${order_amount} has been created."
            logger.info(f"Condition met for order_threshold_alert. Message: {message}")
            # In a real implementation, you would get the owner's contact info and send a notification.
            # self._send_whatsapp("OWNER_PHONE_NUMBER", message)
            # self._send_email("OWNER_EMAIL", "High-Value Order Alert", message)
            print(f"ACTION: Send notification for high-value order: {message}")
        else:
            logger.info("Condition not met for order_threshold_alert", extra={"order_amount": order_amount, "threshold": threshold})


    def _handle_owner_whatsapp_notify(self, automation: Dict[str, Any], payload: Dict[str, Any]):
        config = automation.get("config", {})
        if not self._validate_config(config, ["phone_number"]):
            logger.warning("Invalid config for owner_whatsapp_notify", extra={"automation_id": automation.get("id")})
            return

        phone_number = config["phone_number"]
        message_content = payload.get("content", "A new message was received.")
        message = f"You have a new event in Tamm: {message_content}"
        
        self._send_whatsapp(phone_number, message)


    def _send_whatsapp(self, phone_number: str, message: str):
        """
        Placeholder for sending a WhatsApp message.
        This would integrate with a service like Twilio.
        """
        logger.info(f"Sending WhatsApp message to {phone_number}: '{message}'")
        # response = twilio_client.messages.create(
        #     from_='whatsapp:+14155238886',
        #     body=message,
        #     to=f'whatsapp:{phone_number}'
        # )
        # print(f"WhatsApp message sent with SID: {response.sid}")
        print(f"ACTION: Send WhatsApp to {phone_number}: {message}")
