import uuid
import json
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from rest_framework import exceptions
from rest_framework import serializers

from core.auth import SupabaseJWTAuthentication
from core.permissions import IsWorkspaceMember
from agents.supabase_repo import SupabaseRepo as AgentSupabaseRepo # Use alias to avoid conflict
from knowledge.supabase_repo import KnowledgeSupabaseRepo
from knowledge.chunking import TextChunker
from knowledge.embedding import EmbeddingGenerator
from knowledge.routing import KnowledgeRouter

# --- Serializers ---
class MetadataSerializer(serializers.Serializer):
    """
    Serializer for the metadata associated with the ingested source.
    """
    source_id = serializers.UUIDField(required=False) # For existing messages, etc.
    source_name = serializers.CharField(max_length=255, required=False)
    # Add other relevant metadata fields

class IngestRequestSerializer(serializers.Serializer):
    """
    Serializer for validating the incoming knowledge ingestion request.
    """
    agent_id = serializers.UUIDField()
    source_type = serializers.ChoiceField(choices=['file', 'message', 'external'])
    file = serializers.FileField(required=False)
    metadata = serializers.JSONField(binary=False, required=False) # raw JSON string

    def validate(self, data):
        if data['source_type'] == 'file' and not data.get('file'):
            raise serializers.ValidationError("File is required for 'file' source_type.")
        if data['source_type'] != 'file' and data.get('file'):
            raise serializers.ValidationError("File is only allowed for 'file' source_type.")
        return data

# --- Knowledge Ingestion API View ---
class KnowledgeIngestAPIView(APIView):
    """
    API endpoint for ingesting knowledge into the system.
    Handles file uploads, text extraction, chunking, and routing.
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]
    parser_classes = [MultiPartParser, FormParser] # For handling file uploads

    def post(self, request, *args, **kwargs):
        serializer = IngestRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        agent_id = serializer.validated_data['agent_id']
        source_type = serializer.validated_data['source_type']
        file_obj = serializer.validated_data.get('file')
        metadata_raw = serializer.validated_data.get('metadata', '{}')

        # Ensure metadata is parsed if it's a string
        try:
            metadata = json.loads(metadata_raw) if isinstance(metadata_raw, str) else metadata_raw
        except json.JSONDecodeError:
            raise exceptions.ValidationError("Metadata must be a valid JSON string.")

        # Extract user_id and workspace_id from request context set by middleware
        user_id = request.user.user_id
        workspace_id = request.workspace_id
        user_jwt = request.auth

        # Initialize repositories and utilities
        knowledge_repo = KnowledgeSupabaseRepo(user_jwt)
        # agent_repo = AgentSupabaseRepo(user_jwt) # Can be used to validate agent ownership more deeply
        chunker = TextChunker()
        embedding_generator = EmbeddingGenerator()
        router = KnowledgeRouter()

        # 1. Validate Agent Ownership (basic check)
        # For full validation, fetch agent and check its workspace_id
        # For now, we trust the agent_id from payload is valid for the workspace
        # This will be refined if an agent model is introduced.

        extracted_text = ""
        source_id = metadata.get("source_id", str(uuid.uuid4())) # Use provided source_id or generate new

        if source_type == 'file':
            if not file_obj: # Should be caught by serializer, but as a safeguard
                raise exceptions.ValidationError("File is missing for file source_type.")

            # Store raw file in Supabase Storage
            # file_obj.name is often the original filename
            storage_path = knowledge_repo.upload_file_to_storage(file_obj, file_obj.name, folder=f"{workspace_id}/{agent_id}")
            
            # Simulate text extraction based on file type
            mime_type = file_obj.content_type
            if 'pdf' in mime_type:
                extracted_text = f"Simulated text from PDF: {file_obj.name}. Content sample..."
            elif 'csv' in mime_type:
                extracted_text = f"Simulated text from CSV: {file_obj.name}. Data sample..."
            elif 'text' in mime_type:
                extracted_text = file_obj.read().decode('utf-8')
            else:
                extracted_text = f"Simulated text from unknown file type: {file_obj.name}. Content sample..."

            metadata["file_path"] = storage_path
            metadata["original_filename"] = file_obj.name

        elif source_type == 'message':
            # For 'message' source_type, content is expected in metadata or directly in a 'text_content' field
            extracted_text = metadata.get("text_content", "No text content provided for message source.")
            if not extracted_text:
                 raise exceptions.ValidationError("text_content is required in metadata for 'message' source_type.")

        elif source_type == 'external':
            extracted_text = metadata.get("text_content", "No text content provided for external source.")
            if not extracted_text:
                 raise exceptions.ValidationError("text_content is required in metadata for 'external' source_type.")


        if not extracted_text:
            raise exceptions.ValidationError("Could not extract text from source.")

        # 2. Split text into semantic chunks
        chunks = chunker.chunk_text(extracted_text, source_id=source_id)
        
        # 3. Attach metadata to each chunk
        for chunk in chunks:
            chunk["metadata"].update({
                "workspace_id": str(workspace_id),
                "agent_id": str(agent_id),
                "source_type": source_type,
                "source_id": source_id, # Link back to the original source (file, message, external_id)
                "created_at": "now()" # Placeholder, DB will set
            })
            # 4. Store chunks for embedding (NOT queryable yet)
            knowledge_repo.store_knowledge_chunk(chunk, workspace_id, agent_id)

            # 5. Generate and store embeddings (if routed for RAG)
            # This is where routing decides
            routing_destinations = router.route_knowledge_chunk(chunk)
            if "rag_vectors" in routing_destinations:
                embedding = embedding_generator.generate_embedding(chunk["content"])
                if embedding:
                    knowledge_repo.store_embedding({
                        "workspace_id": workspace_id,
                        "agent_id": agent_id,
                        "content_id": chunk["chunk_id"], # Link embedding to specific chunk
                        "content_type": "knowledge_chunk",
                        "embedding": embedding
                    })

        return Response({"status": "ingested", "source_id": source_id, "chunks_count": len(chunks)}, status=status.HTTP_200_OK)

