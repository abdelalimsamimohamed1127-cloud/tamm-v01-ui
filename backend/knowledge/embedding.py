import openai
import os
import uuid
from typing import List, Dict

from django.conf import settings
from rest_framework import exceptions

# --- AI Client Initialization ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", settings.OPENAI_API_KEY)
if not OPENAI_API_KEY:
    raise exceptions.ImproperlyConfigured("OPENAI_API_KEY is not configured in environment variables or Django settings.")

import time
import logging
from core.errors import AIAProviderError

logger = logging.getLogger(__name__)

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

class EmbeddingGenerator:
    """
    Generates vector embeddings for text using OpenAI's embedding model.
    """
    def __init__(self, model: str = "text-embedding-ada-002"):
        self.client = openai.OpenAI(api_key=OPENAI_API_KEY)
        self.model = model

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generates a single embedding for the given text.
        """
        if not text.strip():
            return []

        if openai_circuit_breaker.is_open():
            raise AIAProviderError("AI provider is currently unavailable for embeddings (Circuit Breaker is open).")

        try:
            response = self.client.embeddings.create(
                input=[text],
                model=self.model,
                timeout=30.0,
            )
            openai_circuit_breaker.record_success()
            return response.data[0].embedding
        except openai.APIError as e:
            openai_circuit_breaker.record_failure()
            logger.error("OpenAI API error during embedding generation", exc_info=True)
            raise AIAProviderError(detail=f"OpenAI API error during embedding generation: {e}")
        except Exception as e:
            openai_circuit_breaker.record_failure()
            logger.error("Failed to generate embedding", exc_info=True)
            raise AIAProviderError(detail=f"Failed to generate embedding: {e}")

    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generates embeddings for a list of texts in a batch.
        """
        if not texts:
            return []

        non_empty_texts = [text for text in texts if text.strip()]
        if not non_empty_texts:
            return [[] for _ in texts]

        if openai_circuit_breaker.is_open():
            raise AIAProviderError("AI provider is currently unavailable for embeddings (Circuit Breaker is open).")

        try:
            response = self.client.embeddings.create(
                input=non_empty_texts,
                model=self.model,
                timeout=60.0,
            )
            openai_circuit_breaker.record_success()

            embeddings_map = {text: embed.embedding for text, embed in zip(non_empty_texts, response.data)}
            result = [embeddings_map.get(text, []) for text in texts]
            return result
        except openai.APIError as e:
            openai_circuit_breaker.record_failure()
            logger.error("OpenAI API error during batch embedding generation", exc_info=True)
            raise AIAProviderError(detail=f"OpenAI API error during batch embedding generation: {e}")
        except Exception as e:
            openai_circuit_breaker.record_failure()
            logger.error("Failed to generate batch embeddings", exc_info=True)
            raise AIAProviderError(detail=f"Failed to generate batch embeddings: {e}")

