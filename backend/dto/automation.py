from rest_framework import serializers

class AutomationDTO(serializers.Serializer):
    id = serializers.UUIDField()
    workspace_id = serializers.UUIDField()
    name = serializers.CharField(max_length=255)
    trigger_event = serializers.CharField(max_length=255)
    action_type = serializers.CharField(max_length=255)
    is_active = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
