from django.urls import path
from agents.views import ChatAPIView, AgentRunAPIView, AgentTemplateListView

urlpatterns = [
    path('v1/ai/chat', ChatAPIView.as_view(), name='ai_chat'),
    path('v1/agent/run', AgentRunAPIView.as_view(), name='agent_run'),
    path('v1/agent_templates', AgentTemplateListView.as_view(), name='agent_templates'), # New endpoint
]
