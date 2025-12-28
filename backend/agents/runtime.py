import uuid
import json
import openai
from django.conf import settings
from rest_framework import exceptions
import time

from agents.supabase_repo import SupabaseRepo
from knowledge.search import HybridSearcher # Import HybridSearcher
from concurrent.futures import ThreadPoolExecutor
import os
import logging # ADDED

from analytics.enrichment import MessageEnrichment # Import MessageEnrichment
from core.errors import AIAProviderError, SupabaseUnavailableError

logger = logging.getLogger(__name__) # ADDED

# --- AI Client Initialization ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise exceptions.ImproperlyConfigured("OPENAI_API_KEY is not configured in environment variables or Django settings.")
openai.api_key = OPENAI_API_KEY

# Thread pool for non-streaming DB operations to avoid blocking SSE
db_executor = ThreadPoolExecutor(max_workers=5)

def get_agent_runtime_config(supabase_repo: SupabaseRepo, agent_id: uuid.UUID, workspace_id: uuid.UUID, mode: str) -> dict:
    """
    Retrieves the agent's runtime configuration (system_prompt and rules) based on the mode.
    Handles version selection (draft/published) and fallback to base agent config.
    """
    try:
        base_agent = supabase_repo.get_base_agent_config(agent_id, workspace_id)
    except exceptions.NotFound:
        raise
    except Exception as e:
        logger.error(f"Error fetching base agent config for {agent_id}: {e}", exc_info=True)
        raise SupabaseUnavailableError(detail=f"Could not fetch base agent configuration: {e}")

    system_prompt = base_agent.get("system_prompt", "You are a helpful AI assistant.")
    rules_jsonb = base_agent.get("rules_jsonb", {})
    version_id = None

    # Determine which version to use based on mode
    if mode == "preview":
        version_id_to_use = base_agent.get("draft_version_id")
    else: # mode == "live" or any other mode
        version_id_to_use = base_agent.get("published_version_id")

    if version_id_to_use:
        try:
            version_config = supabase_repo.get_agent_version_config(version_id_to_use)
            system_prompt = version_config.get("system_prompt", system_prompt) # Fallback to base agent's if not in version
            rules_jsonb = version_config.get("rules_jsonb", rules_jsonb)     # Fallback to base agent's if not in version
            version_id = str(version_id_to_use)
            logger.info(f"Using versioned config for agent {agent_id}, mode {mode}, version_id {version_id}.")
        except exceptions.NotFound:
            logger.warning(f"Version ID {version_id_to_use} not found for agent {agent_id}, mode {mode}. Falling back to base agent config.", extra={"agent_id": str(agent_id), "mode": mode, "version_id": str(version_id_to_use)})
            # Fallback to base agent config if version not found (system_prompt and rules_jsonb already set from base)
        except Exception as e:
            logger.error(f"Error fetching version config {version_id_to_use} for agent {agent_id}: {e}", exc_info=True)
            logger.warning(f"Error fetching version config for agent {agent_id}, mode {mode}. Falling back to base agent config.", extra={"agent_id": str(agent_id), "mode": mode, "version_id": str(version_id_to_use)})
            # Fallback to base agent config in case of error (system_prompt and rules_jsonb already set from base)
    else:
        logger.info(f"No specific version ID found for agent {agent_id}, mode {mode}. Falling back to base agent config.", extra={"agent_id": str(agent_id), "mode": mode})
        # Fallback to base agent config (system_prompt and rules_jsonb already set from base)

    return {
        "system_prompt": system_prompt,
        "rules": rules_jsonb, # Renamed from rules_jsonb to rules as per prompt output
        "version_id": version_id # Can be None if no version is used
    }


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
        self.hybrid_searcher = HybridSearcher(user_jwt) # Initialize HybridSearcher

    def _generate_sse_event(self, event_type: str, data: dict) -> str:
        """Helper to format data as an SSE event."""
        return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

    async def chat_stream(self, agent_id: uuid.UUID, conversation_id: uuid.UUID | None, channel: str, user_message: dict, options: dict):
        """
        Handles the chat interaction, calls the AI model, and streams the response via SSE.
        """
        try:
            # 1. Load Agent Configuration
            try:
                # Use the new helper function to get the agent runtime config
                agent_config_data = get_agent_runtime_config(
                    supabase_repo=self.supabase_repo,
                    agent_id=agent_id,
                    workspace_id=self.workspace_id,
                    mode=options.get('mode', 'live')
                )
            except Exception as e:
                raise SupabaseUnavailableError(detail=f"Could not fetch agent configuration: {e}")

            system_prompt = agent_config_data.get("system_prompt", "You are a helpful AI assistant.")
            rules = agent_config_data.get("rules", {}) # Use 'rules' from the returned dict
            runtime_version_id = agent_config_data.get("version_id") # Get the version_id used
            user_message_content = user_message.get("content", "")

            # 2. Retrieve Knowledge via Hybrid Search
            retrieved_knowledge = await self.hybrid_searcher.hybrid_knowledge_search(
                query=user_message_content,
                agent_id=agent_id,
                workspace_id=self.workspace_id,
                top_k=5 # Adjust as needed or make configurable
            )

            context_messages = []
            citations = []
            if retrieved_knowledge:
                context_text = "\n\n".join([item["content"] for item in retrieved_knowledge])
                context_messages.append({"role": "system", "content": f"Use the following knowledge to answer the user's question:\n{context_text}"})
                citations = [{"source_id": str(item["source_id"]), "content": item["content"]} for item in retrieved_knowledge]
                logger.info(f"Retrieved {len(retrieved_knowledge)} knowledge chunks for agent {agent_id}.")
            else:
                logger.info(f"No relevant knowledge retrieved for agent {agent_id}.")

            messages = [
                {"role": "system", "content": system_prompt},
                *context_messages, # Insert context messages here
                {"role": "user", "content": user_message_content}
            ]

            # 3. Handle Conversation Session & Persistence
            if conversation_id is None:
                new_session_id = self.supabase_repo.create_chat_session(self.workspace_id, agent_id, channel)
                conversation_id = new_session_id
                user_msg_id = db_executor.submit(self.supabase_repo.persist_message, conversation_id, "user", user_message_content).result()
                db_executor.submit(self.message_enrichment.enrich_message, conversation_id, user_message_content, self.workspace_id, agent_id)
            else:
                user_msg_id = db_executor.submit(self.supabase_repo.persist_message, conversation_id, "user", user_message_content).result()
                db_executor.submit(self.message_enrichment.enrich_message, conversation_id, user_message_content, self.workspace_id, agent_id)

            yield self._generate_sse_event(
                "start", 
                {"conversation_id": str(conversation_id), "agent_id": str(agent_id)}
            )

            # 4. Call AI Model (Streaming) with Circuit Breaker
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


            # 5. Persist Assistant Message
            assistant_response_str = "".join(full_assistant_response_content)
            assistant_msg_id = db_executor.submit(self.supabase_repo.persist_message, conversation_id, "assistant", assistant_response_str).result()
            db_executor.submit(self.message_enrichment.enrich_message, conversation_id, assistant_response_str, self.workspace_id, agent_id)

            # Stream 'end' event with citations
            yield self._generate_sse_event("end", {"status": "ok", "citations": citations})

        except (exceptions.NotFound, exceptions.PermissionDenied, SupabaseUnavailableError, AIAProviderError) as e:
            # Re-raising exceptions to be handled by the view and DRF exception handler
            raise e
        except Exception as e:
            # Catch all other unexpected errors
            raise AIAProviderError(detail=f"An unexpected internal error occurred: {e}")
        finally:
            # Ensure the stream always ends cleanly
            pass

    async def playground_run_stream(self, agent_id: uuid.UUID, session_id: uuid.UUID, user_message: str, mode: str):
        """
        Handles the agent playground interaction, calls the AI model, and streams the response via SSE.
        This method also manages session creation/resolution and message persistence.
        """
        try:
            # 1. Load Agent Configuration
            try:
                # Use the new helper function to get the agent runtime config
                agent_config_data = get_agent_runtime_config(
                    supabase_repo=self.supabase_repo,
                    agent_id=agent_id,
                    workspace_id=self.workspace_id,
                    mode=mode
                )
            except Exception as e:
                logger.error(f"Error fetching agent configuration: {e}", exc_info=True)
                raise SupabaseUnavailableError(detail=f"Could not fetch agent configuration: {e}")

            system_prompt = agent_config_data.get("system_prompt", "You are a helpful AI assistant.")
            rules = agent_config_data.get("rules", {}) # Use 'rules' from the returned dict
            runtime_version_id = agent_config_data.get("version_id") # Get the version_id used
            
            # 2. Retrieve Knowledge via Hybrid Search
            retrieved_knowledge = await self.hybrid_searcher.hybrid_knowledge_search(
                query=user_message,
                agent_id=agent_id,
                workspace_id=self.workspace_id,
                top_k=5 # Adjust as needed or make configurable
            )

            context_messages = []
            citations = []
            if retrieved_knowledge:
                context_text = "\n\n".join([item["content"] for item in retrieved_knowledge])
                context_messages.append({"role": "system", "content": f"Use the following knowledge to answer the user's question:\n{context_text}"})
                citations = [{"source_id": str(item["source_id"]), "content": item["content"]} for item in retrieved_knowledge]
                logger.info(f"Retrieved {len(retrieved_knowledge)} knowledge chunks for agent {agent_id}.")
            else:
                logger.info(f"No relevant knowledge retrieved for agent {agent_id}.")

            messages = [
                {"role": "system", "content": system_prompt},
                *context_messages, # Insert context messages here
                {"role": "user", "content": user_message}
            ]
            
            # 3. Resolve Session & Persistence for user message
            # Check if session_id actually refers to an existing session. If not, create it.
            try:
                session_exists = self.supabase_repo.check_session_exists(session_id)
                if not session_exists:
                    # Assuming 'playground' as a default channel for playground sessions
                    self.supabase_repo.create_chat_session(self.workspace_id, agent_id, "playground", session_id)
            except Exception as e:
                logger.error(f"Failed to resolve chat session: {e}", exc_info=True)
                raise SupabaseUnavailableError(detail=f"Failed to resolve chat session: {e}")

            # Persist user message before AI call
            user_msg_id = db_executor.submit(self.supabase_repo.insert_user_message, session_id, user_message).result()
            # Message enrichment can be added later if needed for playground messages
            # db_executor.submit(self.message_enrichment.enrich_message, user_msg_id, user_message, self.workspace_id, agent_id)

            yield self._generate_sse_event(
                "start", 
                {"session_id": str(session_id), "agent_id": str(agent_id), "mode": mode}
            )

            # 4. Call AI Model (Streaming) with Circuit Breaker
            if openai_circuit_breaker.is_open():
                raise AIAProviderError("AI provider is currently unavailable (Circuit Breaker is open).")

            
            # Calculate input_tokens before AI call
            # Simple token approximation (can be replaced by a proper tokenizer later)
            input_tokens = sum(len(m['content'].split()) for m in messages if m['content'])

            full_assistant_response_content = []
            total_completion_tokens = 0
            model_used = agent_config.get("model", "gpt-3.5-turbo") # Get model from config, fallback to default

            try:
                stream = self.openai_client.chat.completions.create(
                    model=model_used, # Use model_used variable
                    messages=messages,
                    stream=True,
                    timeout=30.0,
                )

                for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content is not None:
                        delta_content = chunk.choices[0].delta.content
                        full_assistant_response_content.append(delta_content)
                        # Count tokens (simple approximation for now, real counting should be done by tokenizers)
                        total_completion_tokens += len(delta_content.split()) 
                        yield self._generate_sse_event("token", {"delta": delta_content})
                
                openai_circuit_breaker.record_success()

            except openai.APIError as e:
                openai_circuit_breaker.record_failure()
                logger.error(f"OpenAI API error: {e}", exc_info=True)
                raise AIAProviderError(detail=f"AI provider error: {e}")
            except Exception as e:
                openai_circuit_breaker.record_failure()
                logger.error(f"Unexpected error during AI call: {e}", exc_info=True)
                raise AIAProviderError(detail=f"An unexpected error occurred during AI call: {e}")

            # 5. Persist Assistant Message and Token Usage
            assistant_response_str = "".join(full_assistant_response_content)
            assistant_msg_id = db_executor.submit(self.supabase_repo.insert_ai_message, session_id, assistant_response_str, total_completion_tokens).result()
            
            # Calculate cost and log usage event
            # These are example values; actual pricing should come from a billing service or config
            COST_PER_INPUT_TOKEN = 0.0000005  # Example: $0.50 / 1M tokens for GPT-3.5-turbo-instruct
            COST_PER_OUTPUT_TOKEN = 0.0000015 # Example: $1.50 / 1M tokens for GPT-3.5-turbo-instruct
            
            # For GPT-4o-mini (prices as of Sep 2024 for example)
            if model_used == "gpt-4o-mini":
                COST_PER_INPUT_TOKEN = 0.00000015
                COST_PER_OUTPUT_TOKEN = 0.0000006

            cost_usd = (input_tokens * COST_PER_INPUT_TOKEN) + (total_completion_tokens * COST_PER_OUTPUT_TOKEN)

            db_executor.submit(
                self.supabase_repo.log_usage_event,
                workspace_id=self.workspace_id,
                event_type="model_inference",
                credits_used=None, # Credits deducted by middleware
                agent_id=agent_id,
                channel="playground",
                model=model_used,
                input_tokens=input_tokens,
                output_tokens=total_completion_tokens,
                cost_usd=cost_usd,
                details={"session_id": str(session_id)}
            )

            # Stream 'end' event with citations
            yield self._generate_sse_event("end", {"status": "ok", "tokens_used": total_completion_tokens, "cost_usd": cost_usd, "citations": citations})

        except (exceptions.NotFound, exceptions.PermissionDenied, SupabaseUnavailableError, AIAProviderError) as e:
            logger.error(f"Error in playground_run_stream: {e}", exc_info=True)
            raise e
        except Exception as e:
            logger.error(f"Unhandled exception in playground_run_stream: {e}", exc_info=True)
            raise AIAProviderError(detail=f"An unexpected internal error occurred: {e}")
        finally:
            pass