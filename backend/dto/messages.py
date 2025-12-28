from rest_framework import serializers

class MessageDTO(serializers.Serializer):
    id = serializers.UUIDField()
    workspace_id = serializers.UUIDField()
    agent_id = serializers.UUIDField()
    role = serializers.ChoiceField(
        choices=["user", "assistant", "system"]
    )
    content = serializers.CharField()
    created_at = serializers.DateTimeField()
