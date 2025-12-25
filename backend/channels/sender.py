import os
import uuid
import requests
from typing import Dict, Any

from django.conf import settings
from rest_framework import exceptions

from channels.supabase_repo import ChannelsSupabaseRepo
from core.errors import SupabaseUnavailableError

# --- External API Keys ---
WHATSAPP_API_TOKEN = os.getenv("WHATSAPP_API_TOKEN")
WHATSAPP_BUSINESS_ACCOUNT_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID")

class ChannelSender:
    """
    Handles sending outbound messages to various external channels.
    """
    def __init__(self, user_jwt: str):
        self.repo = ChannelsSupabaseRepo(user_jwt)

    def send_message(self,
                     workspace_id: uuid.UUID,
                     agent_id: uuid.UUID,
                     channel: str,
                     external_user_id: str,
                     content: str,
                     message_type: str = "text"):
        """
        Sends a message to the specified channel provider.
        """
        if channel == "whatsapp":
            self._send_whatsapp_message(workspace_id, agent_id, external_user_id, content, message_type)
        elif channel == "messenger":
            self._send_messenger_message(workspace_id, agent_id, external_user_id, content, message_type)
        elif channel == "instagram":
            self._send_instagram_message(workspace_id, agent_id, external_user_id, content, message_type)
        else:
            raise exceptions.APIException(f"Unsupported channel for sending: {channel}")
        
        self.repo.create_outbound_message({
            "workspace_id": workspace_id,
            "agent_id": agent_id,
            "channel": channel,
            "external_user_id": external_user_id,
            "content": content,
            "message_type": message_type,
            "raw_payload": {"status": "sent", "provider": channel}
        })

    def _send_whatsapp_message(self,
                               workspace_id: uuid.UUID,
                               agent_id: uuid.UUID,
                               recipient_id: str,
                               message_content: str,
                               message_type: str):
        """
        Sends a message via WhatsApp Business API.
        """
        if not WHATSAPP_API_TOKEN or not WHATSAPP_BUSINESS_ACCOUNT_ID:
            raise exceptions.ImproperlyConfigured("WhatsApp API credentials not configured.")

        whatsapp_api_url = f"https://graph.facebook.com/v18.0/{WHATSAPP_BUSINESS_ACCOUNT_ID}/messages"
        
        headers = {
            "Authorization": f"Bearer {WHATSAPP_API_TOKEN}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_id,
            "type": "text",
            "text": {"body": message_content}
        }
        
        try:
            response = requests.post(whatsapp_api_url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            raise exceptions.APIException(f"Failed to send message to WhatsApp: {e}")

    def _send_messenger_message(self,
                                workspace_id: uuid.UUID,
                                agent_id: uuid.UUID,
                                recipient_id: str,
                                message_content: str,
                                message_type: str):
        """
        Sends a message via Facebook Messenger API.
        """
        try:
            page_config = self.repo.fetch_messenger_page_config(workspace_id, agent_id)
            page_access_token = page_config.get("page_access_token")

            if not page_access_token:
                raise exceptions.ImproperlyConfigured(f"Page Access Token not configured for agent {agent_id}")

            messenger_api_url = "https://graph.facebook.com/v18.0/me/messages"
            
            headers = {
                "Authorization": f"Bearer {page_access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "recipient": {"id": recipient_id},
                "message": {"text": message_content},
                "messaging_type": "RESPONSE"
            }
            
            response = requests.post(messenger_api_url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
        except SupabaseUnavailableError as e:
            raise e # Re-raise to be handled by view
        except requests.exceptions.RequestException as e:
            raise exceptions.APIException(f"Failed to send message to Messenger: {e}")
        except Exception as e:
            raise exceptions.APIException(f"An unexpected error occurred while sending to Messenger: {e}")

    def _send_instagram_message(self,
                                workspace_id: uuid.UUID,
                                agent_id: uuid.UUID,
                                recipient_id: str,
                                message_content: str,
                                message_type: str):
        """
        Sends a message via Instagram Messaging API.
        Assumption: The API is similar to Messenger's.
        """
        try:
            # Assumption: A method exists to get Instagram-specific config, including the access token.
            insta_config = self.repo.fetch_instagram_config(workspace_id, agent_id)
            access_token = insta_config.get("access_token")

            if not access_token:
                raise exceptions.ImproperlyConfigured(f"Instagram Access Token not configured for agent {agent_id}")

            # Using the same endpoint as Messenger as per Meta's Graph API structure for Instagram
            instagram_api_url = "https://graph.facebook.com/v18.0/me/messages"
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "recipient": {"id": recipient_id},
                "message": {"text": message_content},
                "messaging_type": "RESPONSE"
            }
            
            response = requests.post(instagram_api_url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
        except SupabaseUnavailableError as e:
            raise e # Re-raise to be handled by view
        except requests.exceptions.RequestException as e:
            raise exceptions.APIException(f"Failed to send message to Instagram: {e}")
        except Exception as e:
            raise exceptions.APIException(f"An unexpected error occurred while sending to Instagram: {e}")