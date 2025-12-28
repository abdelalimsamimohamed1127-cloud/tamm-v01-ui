import uuid
import logging
from typing import List, Dict, Any, Optional

from knowledge.supabase_repo import KnowledgeSupabaseRepo
from knowledge.embedding import EmbeddingGenerator
from knowledge.chunking import TextChunker # Potentially needed for query chunking if query is long
from agents.supabase_repo import SupabaseRepo as AgentSupabaseRepo # To get agent details if needed for model
from django.conf import settings # For constants or settings like embedding model

logger = logging.getLogger(__name__)

class HybridSearcher:
    def __init__(self, user_jwt: str):
        self.knowledge_repo = KnowledgeSupabaseRepo(user_jwt)
        self.embedding_generator = EmbeddingGenerator()
        # self.agent_repo = AgentSupabaseRepo(user_jwt) # Uncomment if agent data is needed here

    async def hybrid_knowledge_search(
        self,
        query: str,
        agent_id: uuid.UUID,
        workspace_id: uuid.UUID, # Need workspace_id for RLS and context
        top_k: int = 8,
        keyword_weight: float = 0.3, # Weight for keyword match score
        vector_weight: float = 0.7, # Weight for vector similarity score
        similarity_threshold: float = 0.7 # Minimum similarity for vector results
    ) -> List[Dict[str, Any]]:
        """
        Performs a hybrid search combining keyword and vector similarity.
        Returns a list of relevant knowledge chunks with their source IDs and content.
        """
        results: Dict[str, Dict[str, Any]] = {} # Use dict to deduplicate and store best score

        # 1. Keyword Search (ILIKE)
        # Using ILIKE for case-insensitive substring search.
        # This is a simple keyword search. For full-text search, a more advanced
        # solution like Supabase's full-text search (tsvector) would be used.
        keyword_matches = self.knowledge_repo.keyword_search_agent_embeddings(
            query=query,
            agent_id=agent_id,
            workspace_id=workspace_id,
            limit=top_k * 2 # Fetch more to allow for ranking
        )
        for match in keyword_matches:
            match_id = str(match["id"])
            results[match_id] = {
                "id": match["id"],
                "source_id": match["source_id"],
                "content": match["content"],
                "score": keyword_weight * 0.9 # Assign a base score for keyword matches
            }

        # 2. Vector Similarity Search
        query_embedding = self.embedding_generator.generate_embedding(query)
        if query_embedding:
            vector_matches = self.knowledge_repo.vector_search_agent_embeddings(
                query_embedding=query_embedding,
                agent_id=agent_id,
                workspace_id=workspace_id,
                match_count=top_k * 2, # Fetch more to allow for ranking
                similarity_threshold=similarity_threshold
            )
            for match in vector_matches:
                match_id = str(match["id"])
                current_score = results.get(match_id, {}).get("score", 0)
                # Combine scores if already present, or add new
                results[match_id] = {
                    "id": match["id"],
                    "source_id": match["source_id"],
                    "content": match["content"],
                    "score": current_score + vector_weight * match["similarity"]
                }
        else:
            logger.warning("Could not generate embedding for query. Skipping vector search.")

        # 3. Merge and Rank Results
        # Convert dict values to list, sort by combined score, and take top_k
        final_results = sorted(
            results.values(),
            key=lambda x: x["score"],
            reverse=True
        )[:top_k]

        return final_results
