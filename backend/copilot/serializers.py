from rest_framework import serializers
import uuid
import datetime

class CopilotChatRequestSerializer(serializers.Serializer):
    """
    Serializer for the incoming copilot chat request body.
    """
    question = serializers.CharField(max_length=1000)
    context = serializers.JSONField(required=False, default=dict)

    def validate_context(self, value):
        # Basic validation for context fields
        if 'range' in value and not isinstance(value['range'], str):
            raise serializers.ValidationError("Context 'range' must be a string (e.g., '7d', '30d').")
        if 'agent_id' in value:
            try:
                uuid.UUID(str(value['agent_id'])) # Validate it's a UUID
            except ValueError:
                raise serializers.ValidationError("Context 'agent_id' must be a valid UUID.")
        return value
