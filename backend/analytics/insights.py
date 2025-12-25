import openai
import os
import json
import uuid
from typing import Dict, Any
import time
import datetime

from django.conf import settings
from rest_framework import exceptions

from analytics.supabase_repo import AnalyticsSupabaseRepo
from concurrent.futures import ThreadPoolExecutor
from core.errors import AIAProviderError

# --- AI Client Initialization ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise exceptions.ImproperlyConfigured("OPENAI_API_KEY is not configured in environment variables or Django settings.")

db_executor = ThreadPoolExecutor(max_workers=5) # For background insight storage

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

openai_circuit_breaker = CircuitBreaker()

class InsightsEngine:
    """
    Generates AI-powered insights from aggregated analytics data.
    """
    def __init__(self, user_jwt: str, workspace_id: uuid.UUID):
        self.openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
        self.analytics_repo = AnalyticsSupabaseRepo(user_jwt)
        self.workspace_id = workspace_id

    def _get_system_prompt(self, persona: str = "workspace_insights") -> str:
        """
        Returns the system prompt for the AI model based on the persona.
        """
        if persona == "workspace_insights":
            return """You are a highly skilled business analyst and data scientist, specializing in social commerce and AI agent performance.
            Your task is to analyze aggregated data, identify trends, explain possible reasons, and suggest actionable insights.
            Focus on agent performance, message sentiment, and user engagement metrics.
            Your analysis should be clear, concise, and professional. Avoid making up data or offering insights not supported by the provided information.
            Structure your response as a JSON object with keys: "explanation", "reasons", "suggestions".
            Example: {"explanation": "...", "reasons": ["...", "..."], "suggestions": ["...", "..."]}
            """
        return "You are a helpful AI assistant." # Default

    def _format_data_for_ai(self, analytics_data: Dict[str, Any]) -> str:
        """
        Converts structured analytics data into a human-readable summary for the AI.
        """
        summary_parts = ["Here is a summary of the analytics data:"]
        
        if analytics_data.get("total_messages") is not None:
            summary_parts.append(f"- Total messages processed: {analytics_data['total_messages']}")
        if analytics_data.get("ai_response_rate") is not None:
            summary_parts.append(f"- AI response rate: {analytics_data['ai_response_rate']:.2%}")
        if analytics_data.get("avg_response_time") is not None:
            summary_parts.append(f"- Average response time (AI): {analytics_data['avg_response_time']} seconds")
        
        sentiment = analytics_data.get("sentiment")
        if sentiment:
            total_sentiment = sum(sentiment.values())
            if total_sentiment > 0:
                positive_perc = (sentiment.get("positive", 0) / total_sentiment) * 100
                neutral_perc = (sentiment.get("neutral", 0) / total_sentiment) * 100
                negative_perc = (sentiment.get("negative", 0) / total_sentiment) * 100
                summary_parts.append(f"- Message Sentiment: Positive {positive_perc:.1f}%, Neutral {neutral_perc:.1f}%, Negative {negative_perc:.1f}%")
        
        return "\n".join(summary_parts)

    def generate_insight(self, question: str, context: Dict[str, Any], agent_id: uuid.UUID = None) -> Dict[str, Any]:
        """
        Generates an AI-powered insight based on a question and analytics context.
        """
        start_date = context.get("start_date", datetime.date.today() - datetime.timedelta(days=7))
        end_date = context.get("end_date", datetime.date.today())

        overview_data = self.analytics_repo.get_overview_metrics(
            workspace_id=self.workspace_id,
            start_date=start_date,
            end_date=end_date,
            agent_id=agent_id
        )
        
        data_summary_for_ai = self._format_data_for_ai(overview_data)

        system_prompt = self._get_system_prompt()
        user_query = f"Based on the following data summary, please answer the question: '{question}'\n\nData Summary:\n{data_summary_for_ai}"

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
                timeout=60.0, # 60-second timeout
            )
            
            insight_raw = response.choices[0].message.content
            insight_json = json.loads(insight_raw)

            openai_circuit_breaker.record_success()

            db_executor.submit(self.analytics_repo.store_insight, {
                "workspace_id": self.workspace_id,
                "agent_id": agent_id,
                "summary_text": insight_raw,
            })

            return insight_json

        except openai.APIError as e:
            openai_circuit_breaker.record_failure()
            raise AIAProviderError(f"OpenAI API error during insight generation: {e}")
        except json.JSONDecodeError as e:
            # This is not an AI provider error, but a data processing error.
            raise exceptions.APIException(f"Failed to parse AI response for insights: {e}. Raw: {insight_raw}")
        except Exception as e:
            openai_circuit_breaker.record_failure()
            raise AIAProviderError(f"Failed to generate insight: {e}")