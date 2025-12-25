# backend/webchat/serializers.py
from rest_framework import serializers

class WebchatMetadataSerializer(serializers.Serializer):
    """
    Serializer for the metadata object within the webchat message payload.
    """
    page_url = serializers.URLField(required=False)
    referrer = serializers.CharField(required=False)

class WebchatMessageSerializer(serializers.Serializer):
    """
    Serializer for incoming webchat messages.
    Validates the payload for the /api/v1/webchat/message endpoint.
    """
    agent_id = serializers.UUIDField(required=True)
    session_id = serializers.CharField(required=False, allow_null=True, max_length=255)
    message = serializers.CharField(required=True, max_length=4096)
    metadata = WebchatMetadataSerializer(required=False)