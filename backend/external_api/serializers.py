# backend/external_api/serializers.py

from rest_framework import serializers
import uuid
from typing import Dict, Any

# Assuming Django ORM models would be defined for these,
# but since they are DB-first, we'll define simple serializers
# that map to the expected fields.

class WorkspaceAPIKeySerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    workspace_id = serializers.UUIDField()
    name = serializers.CharField(max_length=255)
    key_hash = serializers.CharField(max_length=255, write_only=True) # write_only for security
    status = serializers.CharField(read_only=True)
    last_used_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    # For displaying API keys (e.g., in a list) without exposing hash directly
    # A custom field might be needed to indicate status without the hash
    # For creation, the raw key is not passed through here directly, but generated.

class ExternalEventSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    workspace_id = serializers.UUIDField()
    source = serializers.CharField(max_length=255)
    event_type = serializers.CharField(max_length=255)
    payload = serializers.JSONField()
    idempotency_key = serializers.CharField(max_length=255, required=False, allow_null=True)
    received_at = serializers.DateTimeField(read_only=True)

    def create(self, validated_data: Dict[str, Any]) -> Dict[str, Any]:
        # This method is typically implemented when saving to a Django Model.
        # Since we're directly inserting via raw SQL in views for audit/event tables,
        # this serializer mainly serves for validation and data representation.
        # For external_events, the view will handle the direct DB insert.
        return validated_data
