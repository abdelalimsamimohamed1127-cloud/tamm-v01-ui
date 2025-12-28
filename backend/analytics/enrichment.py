import openai
import os
import uuid
from typing import Dict, Any

from django.conf import settings
from rest_framework import exceptions

from analytics.supabase_repo import AnalyticsSupabaseRepo # Use the main AnalyticsSupabaseRepo

import logging

logger = logging.getLogger(__name__)

# --- AI Client Initialization ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", settings.OPENAI_API_KEY)
if not OPENAI_API_KEY:
    raise exceptions.ImproperlyConfigured("OPENAI_API_KEY is not configured in environment variables or Django settings.")

class MessageEnrichment:
    """
    Handles AI-powered message intelligence extraction (topic, sentiment, urgency).
    """
    def __init__(self, user_jwt: str):
        self.openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
        self.analytics_repo = AnalyticsSupabaseRepo(user_jwt) # Use the main repo

    def enrich_message(self, conversation_id: uuid.UUID, message_content: str, workspace_id: uuid.UUID, agent_id: uuid.UUID):
        """
        Sends message content to an AI model for enrichment and updates the conversation.
        """
        try:
            # Craft a prompt for the AI model to extract required intelligence
            prompt_messages = [
                {"role": "system", "content": """You are an expert AI assistant designed to extract key intelligence from a single message within a conversation.
                 For this message, identify the primary topic, the overall sentiment (Positive, Neutral, Negative), and the urgency (Low, Medium, High).
                 Output in JSON format with keys: "topic", "sentiment", "urgency".
                 Example: {"topic": "Refund Inquiry", "sentiment": "Negative", "urgency": "High"}
                 Ensure sentiment is one of: Positive, Neutral, Negative.
                 Ensure urgency is one of: Low, Medium, High.
                 """},
                {"role": "user", "content": f"Analyze the following message:\n\n'{message_content}'"}
            ]

            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo", # Or a more capable model if needed
                messages=prompt_messages,
                response_format={"type": "json_object"}, # Ensure JSON output
                temperature=0.0, # Keep it deterministic for extraction
            )
            
            enrichment_data_raw = response.choices[0].message.content
            enrichment_data = json.loads(enrichment_data_raw)

            # Extract fields, providing defaults to prevent errors if AI fails to adhere to format
            topic = enrichment_data.get("topic", "unknown")
            sentiment = enrichment_data.get("sentiment", "Neutral")
            urgency = enrichment_data.get("urgency", "Low")

            # Persist enrichment data to the conversations table
            self.analytics_repo.update_conversation_enrichment(
                conversation_id=conversation_id,
                sentiment=sentiment,
                topic=topic,
                urgency=urgency,
            )

        except openai.APIError as e:
            logger.error(f"AI provider error during message enrichment for conversation {conversation_id}: {e}", exc_info=True)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response JSON for message enrichment for conversation {conversation_id}: {e}", exc_info=True)
        except Exception as e:
            logger.error(f"Unexpected error during message enrichment for conversation {conversation_id}: {e}", exc_info=True)

