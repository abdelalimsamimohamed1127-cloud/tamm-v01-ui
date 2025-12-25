from rest_framework import serializers

class MessageSerializer(serializers.Serializer):
    """
    Serializer for the message object in the chat request.
    """
    type = serializers.CharField(max_length=50)
    content = serializers.CharField()

class ChatOptionsSerializer(serializers.Serializer):
    """
    Serializer for the options object in the chat request.
    """
    mode = serializers.ChoiceField(choices=['test', 'live'], default='live')

class ChatRequestSerializer(serializers.Serializer):
    """
    Serializer for the incoming chat request body.
    """
    agent_id = serializers.UUIDField()
    conversation_id = serializers.UUIDField(allow_null=True, required=False)
    channel = serializers.CharField(max_length=100)
    message = MessageSerializer()
    options = ChatOptionsSerializer(required=False, default={'mode': 'live'})
