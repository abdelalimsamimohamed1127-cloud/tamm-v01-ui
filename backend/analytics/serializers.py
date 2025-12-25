from rest_framework import serializers
import uuid
import datetime

class AnalyticsQuerySerializer(serializers.Serializer):
    """
    Serializer for common analytics query parameters.
    """
    start_date = serializers.DateField(required=False, default=datetime.date.today() - datetime.timedelta(days=7))
    end_date = serializers.DateField(required=False, default=datetime.date.today())
    agent_id = serializers.UUIDField(required=False)
    channel = serializers.CharField(max_length=100, required=False)

    def validate(self, data):
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError("start_date cannot be after end_date.")
        return data

class InsightsQuestionSerializer(serializers.Serializer):
    """
    Serializer for the Insights Engine POST request body.
    """
    question = serializers.CharField(max_length=500)
    context = serializers.JSONField(required=False, default=dict)

class InsightStorageSerializer(serializers.Serializer):
    """
    Serializer for storing generated insights.
    """
    id = serializers.UUIDField(read_only=True)
    workspace_id = serializers.UUIDField()
    agent_id = serializers.UUIDField(required=False, allow_null=True)
    summary_text = serializers.CharField()
    created_at = serializers.DateTimeField(read_only=True)
