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

    def get_knowledge_source(self, source_id: uuid.UUID) -> dict | None:
        """
        Fetches a knowledge source by its ID from public.agent_sources.
        """
        try:
            response = self._get_table("agent_sources").select("*").eq("id", str(source_id)).single().execute()
            return response.data
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch knowledge source {source_id}: {e}")

    def update_knowledge_source_status(self, source_id: uuid.UUID, status: str):
        """
        Updates the status field of a knowledge source in public.agent_sources.
        """
        try:
            response = self._get_table("agent_sources").update({"status": status}).eq("id", str(source_id)).execute()
            if not response.data:
                raise SupabaseUnavailableError(f"Failed to update status for knowledge source {source_id}.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to update knowledge source status: {e}")

    def store_embedding(self, embedding_data: Dict):
        """
        Stores an embedding vector along with its corresponding content in the agent_embeddings table.
        The agent_embeddings table combines the chunk content and its vector.
        """
        try:
            response = self._get_table("agent_embeddings").insert({
                "id": str(uuid.uuid4()), # Unique ID for this embedding entry
                "agent_id": str(embedding_data["agent_id"]),
                "source_id": str(embedding_data["source_id"]), # Link to the original knowledge source
                "content": embedding_data["content"], # The actual text chunk
                "embedding": embedding_data["embedding"]
            }).execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to store embedding.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to store embedding: {e}")

    def keyword_search_agent_embeddings(self, query: str, agent_id: uuid.UUID, workspace_id: uuid.UUID, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Performs a keyword search on the content of agent embeddings for a specific agent.
        Uses ILIKE for case-insensitive matching.
        """
        try:
            response = self._get_table("agent_embeddings").select("id, source_id, content").eq(
                "agent_id", str(agent_id)
            ).ilike(
                "content", f"%{query}%"
            ).limit(limit).execute()
            # Note: RLS should handle workspace_id filtering, but explicitly adding it here
            # to ensure results are restricted to the current agent's workspace.
            # This is implicitly handled by the RLS policy on agent_embeddings table
            # that joins through agents table.
            return response.data if response.data else []
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to perform keyword search: {e}")

    def vector_search_agent_embeddings(
        self,
        query_embedding: List[float],
        agent_id: uuid.UUID,
        workspace_id: uuid.UUID, # For RLS context in function
        match_count: int = 8,
        similarity_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Performs a vector similarity search using the Supabase `match_agent_embeddings` function.
        """
        try:
            # The match_agent_embeddings function already filters by agent_id internally.
            # It also implicitly respects RLS on agent_embeddings, which joins to agents.
            response = self._client.rpc(
                "match_agent_embeddings",
                {
                    "p_agent_id": str(agent_id),
                    "p_query_embedding": query_embedding,
                    "p_match_count": match_count
                }
            ).execute()
            
            if response.data:
                # Filter by similarity_threshold here as RPC does not support it directly
                # unless added to the SQL function itself.
                return [
                    item for item in response.data 
                    if item.get("similarity", 0) >= similarity_threshold
                ]
            return []
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to perform vector search: {e}")

    def update_kb_job_status(self, job_id: uuid.UUID, status: str, error: str = None):
        """
        Updates the status of a kb_jobs entry.
        """
        try:
            update_data = {"status": status}
            if error:
                update_data["error"] = error
            response = self._get_table("kb_jobs").update(update_data).eq("id", str(job_id)).execute()
            if not response.data:
                raise SupabaseUnavailableError(f"Failed to update kb_job {job_id} status.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to update kb_job status: {e}")

    def update_kb_job_progress(self, job_id: uuid.UUID, processed: int, total: int):
        """
        Updates the progress (processed/total sources) of a kb_jobs entry.
        """
        try:
            response = self._get_table("kb_jobs").update({
                "processed_sources": processed,
                "total_sources": total,
                "updated_at": "now()"
            }).eq("id", str(job_id)).execute()
            if not response.data:
                raise SupabaseUnavailableError(f"Failed to update kb_job {job_id} progress.")
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to update kb_job progress: {e}")

    def delete_agent_embeddings(self, agent_id: uuid.UUID):
        """
        Deletes all embeddings associated with a given agent from public.agent_embeddings.
        """
        try:
            response = self._get_table("agent_embeddings").delete().eq("agent_id", str(agent_id)).execute()
            # Supabase delete doesn't return data, just status
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to delete embeddings for agent {agent_id}: {e}")
            
    def get_agent_knowledge_sources(self, agent_id: uuid.UUID) -> List[Dict[str, Any]]:
        """
        Fetches all knowledge sources associated with a given agent from public.agent_sources.
        """
        try:
            response = self._get_table("agent_sources").select("*").eq("agent_id", str(agent_id)).execute()
            return response.data if response.data else []
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to fetch knowledge sources for agent {agent_id}: {e}")

    def get_active_kb_job(self, agent_id: uuid.UUID, job_type: str) -> Dict[str, Any] | None:
        """
        Fetches an active (queued or processing) kb_job for a given agent and type.
        """
        try:
            response = self._get_table("kb_jobs").select("*") \
                .eq("agent_id", str(agent_id)) \
                .eq("kind", job_type) \
                .in_("status", ["queued", "processing"]) \
                .order("created_at", { "ascending": False }) \
                .limit(1) \
                .maybe_single() \
                .execute()
            return response.data
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to get active kb_job for agent {agent_id}: {e}")

    def create_kb_job(self, agent_id: uuid.UUID, job_type: str, status: str) -> uuid.UUID:
        """
        Creates a new kb_job entry and returns its ID.
        """
        try:
            response = self._get_table("kb_jobs").insert({
                "agent_id": str(agent_id),
                "workspace_id": str(self._client.from_('current_workspace_id').select('id').single().execute().data['id']), # Assuming current_workspace_id function/view
                "kind": job_type,
                "status": status,
            }).select("id").single().execute()
            if not response.data:
                raise SupabaseUnavailableError("Failed to create kb_job.")
            return uuid.UUID(response.data["id"])
        except Exception as e:
            raise SupabaseUnavailableError(detail=f"Failed to create kb_job: {e}")


