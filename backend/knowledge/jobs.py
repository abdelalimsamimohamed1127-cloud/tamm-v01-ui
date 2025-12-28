import uuid
import logging
from django.db import transaction

from knowledge.supabase_repo import KnowledgeSupabaseRepo
from knowledge.chunking import TextChunker
from knowledge.embedding import EmbeddingGenerator
from knowledge.routing import KnowledgeRouter # If needed for routing
from agents.supabase_repo import SupabaseRepo as AgentSupabaseRepo # For updating trained_at

logger = logging.getLogger(__name__)

async def retrain_agent_knowledge(agent_id: uuid.UUID, workspace_id: uuid.UUID, user_jwt: str, job_id: uuid.UUID):
    """
    Asynchronously retrains an agent's knowledge base.
    This involves re-chunking and re-embedding all associated knowledge sources.
    """
    knowledge_repo = KnowledgeSupabaseRepo(user_jwt)
    agent_repo = AgentSupabaseRepo(user_jwt) # Use for updating agent.trained_at
    chunker = TextChunker()
    embedding_generator = EmbeddingGenerator()
    router = KnowledgeRouter() # Initialize if routing is part of chunking/embedding

    try:
        # 1. Update kb_job status to 'processing'
        knowledge_repo.update_kb_job_status(job_id, "processing")
        
        # 2. Delete existing embeddings for this agent
        knowledge_repo.delete_agent_embeddings(agent_id)
        logger.info(f"Deleted existing embeddings for agent {agent_id}.")

        # 3. Fetch all active knowledge sources for the agent
        sources = knowledge_repo.get_agent_knowledge_sources(agent_id)
        if not sources:
            logger.info(f"No knowledge sources found for agent {agent_id}. Retrain complete (no sources).")
            knowledge_repo.update_kb_job_status(job_id, "done")
            agent_repo.update_agent_trained_at(agent_id)
            return

        total_sources = len(sources)
        processed_count = 0

        for source in sources:
            try:
                # Re-fetch source content based on its type and payload
                # This part needs to mimic content extraction from ingest.py
                source_type = source.get('type')
                payload = source.get('payload', {})
                extracted_text = ""

                # --- Content Extraction Logic (Duplicated from ingest.py, consider refactoring) ---
                if source_type == 'file':
                    file_path = payload.get("file_path")
                    if not file_path:
                        logger.error(f"Retrain: File path missing for source {source.get('id')}.")
                        continue
                    # Simulate file content retrieval
                    if ".pdf" in file_path.lower():
                        extracted_text = f"Simulated text from PDF: {file_path}. Content sample for agent {agent_id}."
                    # ... other file types
                    else:
                        extracted_text = f"Simulated text from file: {file_path}. Content sample for agent {agent_id}."

                elif source_type == 'url':
                    url = payload.get("url")
                    if not url:
                        logger.error(f"Retrain: URL missing for source {source.get('id')}.")
                        continue
                    # Simulate web scraping
                    extracted_text = f"Simulated text from URL: {url}. Content sample for agent {agent_id}."

                elif source_type == 'manual':
                    extracted_text = payload.get("text_content")
                    if not extracted_text:
                        logger.error(f"Retrain: Text content missing for source {source.get('id')}.")
                        continue

                elif source_type == 'qna':
                    question = payload.get("question")
                    answer = payload.get("answer")
                    if not question or not answer:
                        logger.error(f"Retrain: Q&A content missing for source {source.get('id')}.")
                        continue
                    extracted_text = f"Question: {question}\nAnswer: {answer}"
                
                if not extracted_text:
                    logger.warning(f"Retrain: No text extracted for source {source.get('id')}. Skipping.")
                    continue

                # 4. Re-chunk text
                chunks = chunker.chunk_text(extracted_text, source_id=str(source.get('id')))

                if not chunks:
                    logger.warning(f"Retrain: No chunks generated for source {source.get('id')}. Skipping.")
                    continue

                # 5. Re-embed and store
                for chunk in chunks:
                    routing_destinations = router.route_knowledge_chunk(chunk)
                    if "rag_vectors" in routing_destinations:
                        embedding = embedding_generator.generate_embedding(chunk["content"])
                        if embedding:
                            knowledge_repo.store_embedding({
                                "agent_id": agent_id,
                                "source_id": uuid.UUID(source.get('id')), # Ensure source_id is UUID
                                "content": chunk["content"],
                                "embedding": embedding
                            })
                        else:
                            logger.warning(f"Retrain: Could not generate embedding for chunk from source {source.get('id')}. Skipping.")
                
                processed_count += 1
                knowledge_repo.update_kb_job_progress(job_id, processed_count, total_sources) # Update progress

            except Exception as e:
                logger.error(f"Error processing source {source.get('id')} during retrain: {e}", exc_info=True)
                # Continue with other sources even if one fails

        # 6. Update agent.trained_at and kb_job status
        knowledge_repo.update_kb_job_status(job_id, "done")
        agent_repo.update_agent_trained_at(agent_id)
        logger.info(f"Agent {agent_id} knowledge retraining completed. Processed {processed_count}/{total_sources} sources.")

    except Exception as e:
        logger.error(f"Unhandled error during agent knowledge retraining for agent {agent_id}: {e}", exc_info=True)
        knowledge_repo.update_kb_job_status(job_id, "failed", str(e))