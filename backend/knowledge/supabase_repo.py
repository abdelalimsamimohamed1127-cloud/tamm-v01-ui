import os
import uuid
import mimetypes
from typing import List, Dict, Any
from supabase import create_client, Client
from django.conf import settings
from rest_framework import exceptions

# --- Supabase Client Initialization ---
SUPABASE_URL = os.getenv("SUPABASE_URL", settings.SUPABASE_URL)
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", settings.SUPABASE_ANON_KEY)

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise exceptions.ImproperlyConfigured(
        "SUPABASE_URL and SUPABASE_ANON_KEY must be configured in environment variables or Django settings."
    )

from core.errors import SupabaseUnavailableError

class KnowledgeSupabaseRepo:
    """
    Repository for interacting with Supabase for knowledge ingestion and storage.
    """
    def __init__(self, user_jwt: str):
        if not user_jwt:
            raise ValueError("user_jwt is required for KnowledgeSupabaseRepo to enforce RLS.")
        self._client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY, options={"headers": {"Authorization": f"Bearer {user_jwt}"}})

    def _get_table(self, table_name: str):
        return self._client.table(table_name)

    def _get_storage_bucket(self, bucket_name: str):
        return self._client.storage.from_(bucket_name)

    def upload_file_to_storage(self, file_object, file_name: str, folder: str = "raw_knowledge") -> str:
        """
        Uploads a file object to Supabase Storage.
        """
        try:
            bucket_name = "knowledge-files"
            file_path = f"{folder}/{file_name}"
            content_type = mimetypes.guess_type(file_name)[0] or "application/octet-stream"
            response = self._get_storage_bucket(bucket_name).upload(
                path=file_path,
                file=file_object.read(),
                file_options={"content-type": content_type}
            )
            return response.get('path')
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to upload file to Supabase Storage: {e}")

    def store_knowledge_chunk(self, chunk: Dict, workspace_id: uuid.UUID, agent_id: uuid.UUID):
        """
        Stores a processed knowledge chunk and its metadata.
        """
        try:
            response = self._get_table("knowledge_chunks").insert({
                "id": str(uuid.uuid4()),
                "chunk_id": chunk.get("chunk_id"),
                "content": chunk.get("content"),
                "metadata": chunk.get("metadata"),
                "workspace_id": str(workspace_id),
                "agent_id": str(agent_id),
            }).execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to store knowledge chunk.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to store knowledge chunk: {e}")

    def store_embedding(self, embedding_data: Dict):
        """
        Stores an embedding vector in the pgvector table.
        """
        try:
            response = self._get_table("embeddings").insert({
                "id": str(uuid.uuid4()),
                "workspace_id": str(embedding_data["workspace_id"]),
                "agent_id": str(embedding_data["agent_id"]),
                "content_id": str(embedding_data["content_id"]),
                "content_type": embedding_data["content_type"],
                "embedding": embedding_data["embedding"]
            }).execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to store embedding.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to store embedding: {e}")

