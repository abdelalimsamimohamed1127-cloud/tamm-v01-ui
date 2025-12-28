from django.urls import path
from copilot.views import CopilotInsightsChatAPIView

urlpatterns = [
    path('v1/copilot/chat', CopilotInsightsChatAPIView.as_view(), name='copilot_chat'),
]
