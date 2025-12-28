import openai
import os
import json
import uuid
import datetime
import time
from typing import Dict, Any, Optional

from django.conf import settings
from rest_framework import exceptions

from copilot.supabase_repo import CopilotSupabaseRepo
from copilot.persona import CopilotPersona
from concurrent.futures import ThreadPoolExecutor
from core.errors import AIAProviderError, SupabaseUnavailableError

# --- AI Client Initialization ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise exceptions.ImproperlyConfigured("OPENAI_API_KEY is not configured in environment variables or Django settings.")

db_executor = ThreadPoolExecutor(max_workers=2)

class CircuitBreaker:
    FAILURE_THRESHOLD = 3
    RECOVERY_TIMEOUT = 60

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

openai_circuit_breaker = CircuitBreaker()

class CopilotRuntime:
    """
    Orchestrates the Analytical AI Copilot's execution flow.
    """
    def __init__(self, user_jwt: str, workspace_id: uuid.UUID):
        self.openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
        self.repo = CopilotSupabaseRepo(user_jwt)
        self.workspace_id = workspace_id

    def _parse_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parses and validates the context provided in the request.
        """
        parsed_context = {
            "start_date": datetime.date.today() - datetime.timedelta(days=7),
            "end_date": datetime.date.today(),
            "agent_id": None,
            "channel": None,
        }

        if 'range' in context and isinstance(context['range'], str):
            if context['range'].endswith('d'):
                try:
                    days = int(context['range'][:-1])
                    parsed_context['start_date'] = datetime.date.today() - datetime.timedelta(days=days)
                except ValueError:
                    pass

        if 'start_date' in context and isinstance(context['start_date'], str):
            try: parsed_context['start_date'] = datetime.date.fromisoformat(context['start_date'])
            except ValueError: pass
        if 'end_date' in context and isinstance(context['end_date'], str):
            try: parsed_context['end_date'] = datetime.date.fromisoformat(context['end_date'])
            except ValueError: pass
        
        if parsed_context['start_date'] > parsed_context['end_date']:
            parsed_context['start_date'] = parsed_context['end_date'] - datetime.timedelta(days=7)

        if 'agent_id' in context and context['agent_id']:
            try: parsed_context['agent_id'] = uuid.UUID(str(context['agent_id']))
            except (ValueError, TypeError): pass
        if 'channel' in context and context['channel']:
            parsed_context['channel'] = str(context['channel'])

        return parsed_context

    def chat_with_copilot(self, question: str, raw_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes a question, gathers data, and generates an AI-powered insight.
        """
        context = self._parse_context(raw_context)
        
        try:
            # Load workspace context: plan and credits
            workspace_plan = self.repo.get_workspace_plan(self.workspace_id)
            workspace_credits = self.repo.get_workspace_credits(self.workspace_id)
            
            # Decide if the user is on a paid plan based on workspace_plan
            # Assuming 'free' is the slug for the free plan, and anything else is paid
            is_paid_plan = workspace_plan not in ['free', None]
            
            # Instantiate CopilotPersona with the plan information
            copilot_persona = CopilotPersona(is_paid_plan=is_paid_plan)

            analytics_data = self.repo.get_overview_metrics(
                workspace_id=self.workspace_id,
                start_date=context['start_date'],
                end_date=context['end_date'],
                agent_id=context['agent_id'],
                channel=context['channel']
            )

            data_summary_for_ai = copilot_persona.format_analytics_for_ai(analytics_data, context)
            
            system_prompt = copilot_persona.get_system_prompt()
            # If it's a free plan and analytics summarization is not allowed,
            # we should not include analytics data in the user_query.
            if not is_paid_plan:
                 # The persona already handles this by returning a generic string in format_analytics_for_ai
                user_query = f"Please answer the question: '{question}'"
            else:
                user_query = f"Based on the provided analytics data, please answer the question: '{question}'\n\nAnalytics Data Summary:\n{data_summary_for_ai}"

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query}
            ]

            if openai_circuit_breaker.is_open():
                raise AIAProviderError("AI provider is currently unavailable (Circuit Breaker is open).")

            try:
                response = self.openai_client.chat.completions.create(
                    model="gpt-4-turbo-preview",
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    timeout=60.0,
                )
                
                insight_raw = response.choices[0].message.content
                insight_json = json.loads(insight_raw)

                openai_circuit_breaker.record_success()

                # Log LLM token usage
                if response.usage:
                    self.repo.log_copilot_usage_event(
                        workspace_id=self.workspace_id,
                        input_tokens=response.usage.prompt_tokens,
                        output_tokens=response.usage.completion_tokens,
                        model=response.model,
                        cost_usd=0.0, # Placeholder for now, actual cost calculation needs to be implemented
                        details={"question": question, "response_type": "copilot_chat"}
                    )

                db_executor.submit(self.repo.store_insight, {
                    "workspace_id": self.workspace_id,
                    "agent_id": context['agent_id'],
                    "summary_text": insight_raw,
                    "context": raw_context,
                })

                return insight_json

            except openai.APIError as e:
                openai_circuit_breaker.record_failure()
                raise AIAProviderError(f"OpenAI API error during copilot insight generation: {e}")
            except json.JSONDecodeError as e:
                raise exceptions.APIException(f"Failed to parse AI response for copilot insights. Raw: {insight_raw}")
            except Exception as e:
                openai_circuit_breaker.record_failure()
                raise AIAProviderError(f"Failed to generate copilot insight: {e}")

        except SupabaseUnavailableError as e:
            raise e
        except Exception as e:
            raise exceptions.APIException(f"An unexpected error occurred: {e}")
