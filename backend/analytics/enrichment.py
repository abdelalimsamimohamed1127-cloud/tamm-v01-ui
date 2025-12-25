import openai
import os
import uuid
from typing import Dict, Any

from django.conf import settings
from rest_framework import exceptions

from analytics.supabase_repo import MessageEnrichmentSupabaseRepo

# --- AI Client Initialization ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", settings.OPENAI_API_KEY)
if not OPENAI_API_KEY:
    raise exceptions.ImproperlyConfigured("OPENAI_API_KEY is not configured in environment variables or Django settings.")

class MessageEnrichment:
    """
    Handles AI-powered message intelligence extraction (topic, intent, sentiment).
    """
    def __init__(self, user_jwt: str):
        self.openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
        self.analytics_repo = MessageEnrichmentSupabaseRepo(user_jwt)

    def enrich_message(self, message_id: uuid.UUID, message_content: str, workspace_id: uuid.UUID, agent_id: uuid.UUID):
        """
        Sends message content to an AI model for enrichment and persists the results.
        """
        try:
            # Craft a prompt for the AI model to extract required intelligence
            prompt_messages = [
                {"role": "system", "content": """You are an expert AI assistant designed to extract key intelligence from messages. 
                 For each message, identify the primary topic, the user's intent, and the sentiment.
                 Output in JSON format with keys: "topic", "intent", "sentiment" (Positive, Neutral, Negative), and "entities" (list of key entities).
                 Example: {"topic": "Product Inquiry", "intent": "Ask for details", "sentiment": "Neutral", "entities": ["product X", "price"]}
                 Ensure sentiment is one of: Positive, Neutral, Negative.
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
            intent = enrichment_data.get("intent", "unknown")
            sentiment = enrichment_data.get("sentiment", "Neutral")
            entities = enrichment_data.get("entities", [])

            # Persist enrichment data
            self.analytics_repo.persist_message_enrichment({
                "message_id": message_id,
                "workspace_id": workspace_id,
                "agent_id": agent_id,
                "topic": topic,
                "intent": intent,
                "sentiment": sentiment,
                "entities": entities,
            })

        except openai.APIError as e:
            print(f"AI provider error during message enrichment: {e}")
            # Consider logging this failure without raising, as it's a background process
        except json.JSONDecodeError as e:
            print(f"Failed to parse AI response JSON for message enrichment: {e}")
        except Exception as e:
            print(f"Unexpected error during message enrichment: {e}")
