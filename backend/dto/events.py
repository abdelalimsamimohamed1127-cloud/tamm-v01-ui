from rest_framework import serializers

class ExternalEventDTO(serializers.Serializer):
    id = serializers.UUIDField()
    workspace_id = serializers.UUIDField()
    event_type = serializers.CharField(max_length=255)
    payload = serializers.JSONField()
    created_at = serializers.DateTimeField()
