from django.urls import path
from knowledge.ingest import KnowledgeIngestAPIView

urlpatterns = [
    path('v1/knowledge/ingest', KnowledgeIngestAPIView.as_view(), name='knowledge_ingest'),
]
