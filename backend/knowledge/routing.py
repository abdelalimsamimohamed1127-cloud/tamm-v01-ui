import uuid
from typing import Dict, Literal

class KnowledgeRouter:
    """
    Applies routing rules to knowledge data (chunks, messages) based on type and metadata.
    For Stage 3, this primarily decides if data goes to RAG preparation or analytics.
    """

    def route_knowledge_chunk(self, chunk: Dict) -> List[Literal["rag_vectors", "analytics_tables", "audit_logs"]]:
        """
        Routes an ingested knowledge chunk.
        """
        destinations = []
        source_type = chunk.get("metadata", {}).get("source_type")
        
        # Example routing rules
        if source_type in ["file", "external"]:
            # Policies / Docs typically go to RAG
            destinations.append("rag_vectors")
            destinations.append("audit_logs") # Always audit ingestion
        elif source_type == "message":
            # Selected messages can also go to RAG
            # For now, all messages go through enrichment first, then routing decides if they are embedded.
            destinations.append("rag_vectors") # Assuming relevant messages are routed for RAG
            destinations.append("analytics_tables") # Even if embedded, might contribute to analytics
            destinations.append("audit_logs")
        
        # Add more sophisticated routing based on actual content or metadata if needed
        # e.g., if "topic" in chunk_metadata and chunk_metadata["topic"] == "complaint":
        #    destinations.append("analytics_tables")

        return list(set(destinations)) # Return unique destinations

    def route_message_for_enrichment(self, message_content: str, message_metadata: Dict) -> bool:
        """
        Determines if a message should be routed for AI enrichment.
        For Stage 3, assume all messages are enriched.
        """
        # In a more complex system, this might check message type, channel, etc.
        # e.g., if message_metadata.get("channel") == "kpi_updates":
        #    return False
        return True
