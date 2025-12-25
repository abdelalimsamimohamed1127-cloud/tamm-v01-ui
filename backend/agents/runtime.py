import uuid
import json
import openai
from django.conf import settings
from rest_framework import exceptions
import time

from agents.supabase_repo import SupabaseRepo
from concurrent.futures import ThreadPoolExecutor
import os

from analytics.enrichment import MessageEnrichment # Import MessageEnrichment
from core.errors import AIAProviderError, SupabaseUnavailableError

# --- AI Client Initialization ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise exceptions.ImproperlyConfigured("OPENAI_API_KEY is not configured in environment variables or Django settings.")
openai.api_key = OPENAI_API_KEY

# Thread pool for non-streaming DB operations to avoid blocking SSE
db_executor = ThreadPoolExecutor(max_workers=5)

class CircuitBreaker:
    FAILURE_THRESHOLD = 3
    RECOVERY_TIMEOUT = 60  # seconds

    def __init__(self):
        self.failures = 0
        self.last_failure_time = 0
        self.state = "CLOSED"

    def is_open(self):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.RECOVERY_TIMEOUT:
                self.state = "HALF-OPEN"
                return False
            return True
        return False

    def record_failure(self):
        self.failures += 1
        if self.failures >= self.FAILURE_THRESHOLD:
            self.state = "OPEN"
            self.last_failure_time = time.time()

    def record_success(self):
        self.state = "CLOSED"
        self.failures = 0

# A global circuit breaker for OpenAI API
openai_circuit_breaker = CircuitBreaker()


class AgentRuntime:
    """
    Orchestrates agent message processing, AI model calls, and streaming responses.
    """
    def __init__(self, user_id: uuid.UUID, workspace_id: uuid.UUID, user_jwt: str):
        self.user_id = user_id
        self.workspace_id = workspace_id
        self.supabase_repo = SupabaseRepo(user_jwt) # Initialize repo with user's JWT
        self.openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
        self.message_enrichment = MessageEnrichment(user_jwt) # Initialize MessageEnrichment

    def _generate_sse_event(self, event_type: str, data: dict) -> str:
        """Helper to format data as an SSE event."""
        return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

    def chat_stream(self, agent_id: uuid.UUID, conversation_id: uuid.UUID | None, channel: str, user_message: dict, options: dict):
        """
        Handles the chat interaction, calls the AI model, and streams the response via SSE.
        """
        try:
            # 1. Load Agent Configuration
            try:
                agent_config = self.supabase_repo.fetch_agent_config(agent_id, self.workspace_id, options.get('mode', 'live'))
            except Exception as e:
                raise SupabaseUnavailableError(detail=f"Could not fetch agent configuration: {e}")

            system_prompt = agent_config.get("system_prompt", "You are a helpful AI assistant.")
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message.get("content")}
            ]

            # 2. Handle Conversation Session & Persistence
            if conversation_id is None:
                new_session_id = self.supabase_repo.create_chat_session(self.workspace_id, agent_id, channel)
                conversation_id = new_session_id
                user_msg_id = db_executor.submit(self.supabase_repo.persist_message, conversation_id, "user", user_message.get("content")).result()
                db_executor.submit(self.message_enrichment.enrich_message, user_msg_id, user_message.get("content"), self.workspace_id, agent_id)
            else:
                user_msg_id = db_executor.submit(self.supabase_repo.persist_message, conversation_id, "user", user_message.get("content")).result()
                db_executor.submit(self.message_enrichment.enrich_message, user_msg_id, user_message.get("content"), self.workspace_id, agent_id)

            yield self._generate_sse_event(
                "start", 
                {"conversation_id": str(conversation_id), "agent_id": str(agent_id)}
            )

            # 3. Call AI Model (Streaming) with Circuit Breaker
            if openai_circuit_breaker.is_open():
                raise AIAProviderError("AI provider is currently unavailable (Circuit Breaker is open).")

            try:
                full_assistant_response = []
                stream = self.openai_client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=messages,
                    stream=True,
                    timeout=30.0, # 30-second timeout for the API call
                )

                for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content is not None:
                        delta_content = chunk.choices[0].delta.content
                        full_assistant_response.append(delta_content)
                        yield self._generate_sse_event("token", {"delta": delta_content})
                
                openai_circuit_breaker.record_success()

            except openai.APIError as e:
                openai_circuit_breaker.record_failure()
                raise AIAProviderError(detail=f"AI provider error: {e}")
            except Exception as e:
                openai_circuit_breaker.record_failure()
                raise AIAProviderError(detail=f"An unexpected error occurred during AI call: {e}")


            # 4. Persist Assistant Message
            assistant_msg_id = db_executor.submit(self.supabase_repo.persist_message, conversation_id, "assistant", "".join(full_assistant_response)).result()
            db_executor.submit(self.message_enrichment.enrich_message, assistant_msg_id, "".join(full_assistant_response), self.workspace_id, agent_id)

            # Stream 'end' event
            yield self._generate_sse_event("end", {"status": "ok"})

        except (exceptions.NotFound, exceptions.PermissionDenied, SupabaseUnavailableError, AIAProviderError) as e:
            # Re-raising exceptions to be handled by the view and DRF exception handler
            raise e
        except Exception as e:
            # Catch all other unexpected errors
            raise AIAProviderError(detail=f"An unexpected internal error occurred: {e}")
        finally:
            # Ensure the stream always ends cleanly
            pass