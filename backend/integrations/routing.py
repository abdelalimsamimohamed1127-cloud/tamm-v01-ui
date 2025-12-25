import uuid
from typing import Dict, Any, Literal, List
from knowledge.chunking import TextChunker
from knowledge.embedding import EmbeddingGenerator
from knowledge.supabase_repo import KnowledgeSupabaseRepo
from analytics.supabase_repo import AnalyticsSupabaseRepo
from concurrent.futures import ThreadPoolExecutor

# Thread pool for background tasks like embedding generation and analytics logging
background_executor = ThreadPoolExecutor(max_workers=5)

import logging
from core.errors import SupabaseUnavailableError, AIAProviderError

logger = logging.getLogger(__name__)

class IntegrationsRouter:
    """
    Routes canonical data records to appropriate downstream pipelines.
    """
    def __init__(self, user_jwt: str, workspace_id: uuid.UUID):
        self.knowledge_repo = KnowledgeSupabaseRepo(user_jwt)
        self.analytics_repo = AnalyticsSupabaseRepo(user_jwt)
        self.chunker = TextChunker()
        self.embedding_generator = EmbeddingGenerator()
        self.workspace_id = workspace_id
        self.user_jwt = user_jwt

    def route_canonical_data(self, record: Dict[str, Any]):
        """
        Routes a single canonical data record based on its entity_type.
        """
        entity_type = record.get("entity_type")
        logger.info(
            "Routing canonical data",
            extra={
                "workspace_id": self.workspace_id,
                "entity_type": entity_type,
                "record_id": record.get("id"),
            },
        )
        
        try:
            if entity_type == "policy_document":
                self._process_for_rag(record, "policy_document")
            elif entity_type == "employee_complaint":
                self._process_for_rag(record, "employee_complaint")
                self._process_for_analytics(record, "employee_complaint")
            elif entity_type == "employee_kpi":
                self._process_for_analytics(record, "employee_kpi")
            elif entity_type == "employee_profile":
                pass
            else:
                logger.warning(f"No specific routing defined for entity type: {entity_type}")
        except Exception as e:
            logger.error(
                "Error routing canonical data",
                extra={"workspace_id": self.workspace_id, "record_id": record.get("id"), "error": str(e)},
                exc_info=True,
            )
            # Depending on the desired behavior, you might want to re-raise the exception
            # For now, we log it and move on, so one bad record doesn't stop a batch.


    def _process_for_rag(self, record: Dict[str, Any], content_type: str):
        """
        Converts text-based canonical data into chunks, generates embeddings, and stores vectors.
        """
        logger.info(f"Processing record for RAG: {record.get('id')}")
        content_field = ""
        if content_type == "policy_document":
            content_field = record.get("content", "")
        elif content_type == "employee_complaint":
            content_field = record.get("description", "")
        
        if not content_field:
            logger.warning(f"Skipping RAG for {content_type} due to empty content.", extra={"record_id": record.get("id")})
            return

        try:
            chunks = self.chunker.chunk_text(content_field, source_id=record["source_reference"])
            
            for chunk in chunks:
                try:
                    chunk["metadata"].update({
                        "workspace_id": str(self.workspace_id),
                        "agent_id": record.get("agent_id"),
                        "source_type": content_type,
                        "source_id": record["source_reference"],
                        "canonical_record_id": record.get("id"),
                    })
                    
                    embedding = self.embedding_generator.generate_embedding(chunk["content"])
                    
                    if embedding:
                        background_executor.submit(self.knowledge_repo.store_embedding, {
                            "workspace_id": self.workspace_id,
                            "agent_id": record.get("agent_id"),
                            "content_id": chunk["chunk_id"],
                            "content_type": content_type,
                            "embedding": embedding
                        })
                    else:
                        logger.warning(f"Embedding generation failed for chunk {chunk['chunk_id']}.")
                except Exception as e:
                    logger.error(f"Error processing chunk {chunk['chunk_id']} for RAG", exc_info=True)
        except Exception as e:
            logger.error(f"Failed to process record for RAG: {record.get('id')}", exc_info=True)
            raise AIAProviderError(detail=f"Failed to process record for RAG: {e}")

    def _process_for_analytics(self, record: Dict[str, Any], entity_type: str):
        """
        Logs relevant data for analytics from canonical records.
        """
        logger.info(
            f"Processing {entity_type} for analytics",
            extra={"record_id": record.get("id"), "workspace_id": self.workspace_id}
        )
        # In a real system, this would trigger further processing or storage
        # in a data warehouse. For now, logging is sufficient.
        # Example: self.analytics_repo.log_complaint_event(...)
        pass
