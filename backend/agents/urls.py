from django.urls import path
from agents.views import ChatAPIView

urlpatterns = [
    path('v1/ai/chat', ChatAPIView.as_view(), name='ai_chat'),
]
