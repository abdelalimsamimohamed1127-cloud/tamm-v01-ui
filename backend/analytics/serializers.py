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
    insight_type = serializers.CharField(max_length=100, required=False)

    def validate(self, data):
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError("start_date cannot be after end_date.")
        return data

class InsightsQuestionSerializer(serializers.Serializer):
    """
    Serializer for the Insights Engine POST request body, for AI-powered questions.
    """
    question = serializers.CharField(max_length=500, required=False) # Make optional for structured insights
    context = serializers.JSONField(required=False, default=dict)

class StructuredInsightRequestSerializer(serializers.Serializer):
    """
    Serializer for triggering structured insight generation.
    """
    period_start = serializers.DateField()
    period_end = serializers.DateField()

    def validate(self, data):
        if data['period_start'] > data['period_end']:
            raise serializers.ValidationError("period_start cannot be after period_end.")
        return data

class InsightStorageSerializer(serializers.Serializer):
    """
    Serializer for storing generated insights.
    """
    id = serializers.UUIDField(read_only=True)
    workspace_id = serializers.UUIDField()
    period_start = serializers.DateField()
    period_end = serializers.DateField()
    insight_type = serializers.CharField(max_length=100)
    title = serializers.CharField(max_length=255)
    summary = serializers.CharField()
    payload = serializers.JSONField()
    created_at = serializers.DateTimeField(read_only=True)
