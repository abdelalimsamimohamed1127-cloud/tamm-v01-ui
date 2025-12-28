import uuid
import json
from django.conf import settings
from rest_framework import exceptions # Keep for potential internal exceptions
from knowledge.supabase_repo import KnowledgeSupabaseRepo
from knowledge.chunking import TextChunker
from knowledge.embedding import EmbeddingGenerator
from knowledge.routing import KnowledgeRouter

import logging

logger = logging.getLogger(__name__)

# Renamed and refactored from KnowledgeIngestAPIView's post method
def trigger_ingestion_job(source_id: uuid.UUID, agent_id: uuid.UUID, workspace_id: uuid.UUID, user_jwt: str):
    """
    Triggers the knowledge ingestion process for a given source.
    This function will fetch the source details, extract content, chunk, embed,
    and store the knowledge.
    """
    knowledge_repo = KnowledgeSupabaseRepo(user_jwt)
    chunker = TextChunker()
    embedding_generator = EmbeddingGenerator()
    router = KnowledgeRouter()

    try:
        source = knowledge_repo.get_knowledge_source(source_id)

        if not source:
            logger.error(f"Ingestion failed: Knowledge source {source_id} not found.")
            knowledge_repo.update_knowledge_source_status(source_id, "failed")
            return

        source_type = source.get('type')
        payload = source.get('payload', {})
        extracted_text = ""

        # --- Content Extraction Logic ---
        if source_type == 'file':
            # For files, the payload should contain a path to the file in storage
            file_path = payload.get("file_path")
            if not file_path:
                logger.error(f"Ingestion failed for source {source_id}: File path missing in payload.")
                knowledge_repo.update_knowledge_source_status(source_id, "failed")
                return
            
            # Simulate file content retrieval (in a real scenario, you'd download from storage)
            # For now, let's assume `file_path` contains enough info to mock content
            # This part needs actual implementation to download and extract text from files
            # For this task, we will simulate text extraction.
            if ".pdf" in file_path.lower():
                extracted_text = f"Simulated text from PDF: {file_path}. Content sample for agent {agent_id}."
            elif ".docx" in file_path.lower():
                extracted_text = f"Simulated text from DOCX: {file_path}. Content sample for agent {agent_id}."
            elif ".txt" in file_path.lower():
                extracted_text = f"Simulated text from TXT: {file_path}. Content sample for agent {agent_id}."
            else:
                extracted_text = f"Simulated text from unknown file type: {file_path}. Content sample for agent {agent_id}."
            
            # In a real system, you'd integrate a library here for parsing files (e.g., pdfminer, docx2txt)
            logger.info(f"Simulated text extraction for file source {source_id}")

        elif source_type == 'url':
            url = payload.get("url")
            if not url:
                logger.error(f"Ingestion failed for source {source_id}: URL missing in payload.")
                knowledge_repo.update_knowledge_source_status(source_id, "failed")
                return
            # Simulate web scraping
            extracted_text = f"Simulated text from URL: {url}. Content sample for agent {agent_id}."
            logger.info(f"Simulated web scraping for URL source {source_id}")

        elif source_type == 'manual': # For pasted text
            extracted_text = payload.get("text_content")
            if not extracted_text:
                logger.error(f"Ingestion failed for source {source_id}: Text content missing in payload.")
                knowledge_repo.update_knowledge_source_status(source_id, "failed")
                return

        elif source_type == 'qna':
            question = payload.get("question")
            answer = payload.get("answer")
            if not question or not answer:
                logger.error(f"Ingestion failed for source {source_id}: Q&A content missing in payload.")
                knowledge_repo.update_knowledge_source_status(source_id, "failed")
                return
            extracted_text = f"Question: {question}\nAnswer: {answer}"
        else:
            logger.error(f"Ingestion failed for source {source_id}: Unknown source type {source_type}.")
            knowledge_repo.update_knowledge_source_status(source_id, "failed")
            return

        if not extracted_text:
            logger.error(f"Ingestion failed for source {source_id}: No text extracted.")
            knowledge_repo.update_knowledge_source_status(source_id, "failed")
            return

        # 2. Split text into semantic chunks
        chunks = chunker.chunk_text(extracted_text, source_id=str(source_id))
        
        # If no chunks, mark as failed
        if not chunks:
            logger.warning(f"No chunks generated for source {source_id}.")
            knowledge_repo.update_knowledge_source_status(source_id, "failed")
            return


        # 3. Process each chunk
        for chunk in chunks:
            # Generate and store embeddings (if routed for RAG)
            routing_destinations = router.route_knowledge_chunk(chunk) # Assuming chunk has metadata needed for routing
            if "rag_vectors" in routing_destinations:
                embedding = embedding_generator.generate_embedding(chunk["content"])
                if embedding:
                    knowledge_repo.store_embedding({
                        "agent_id": agent_id,
                        "source_id": source_id,
                        "content": chunk["content"], # The actual text chunk
                        "embedding": embedding
                    })
                else:
                    logger.warning(f"Could not generate embedding for chunk from source {source_id}. Skipping.")
        
        # 4. Update source status to 'active' on success
        knowledge_repo.update_knowledge_source_status(source_id, "active")
        logger.info(f"Successfully ingested knowledge for source {source_id}. Chunks: {len(chunks)}")

    except Exception as e:
        logger.error(f"Error during ingestion job for source {source_id}: {e}", exc_info=True)
        knowledge_repo.update_knowledge_source_status(source_id, "failed")