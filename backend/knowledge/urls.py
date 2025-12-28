from django.urls import path
from knowledge.views import KnowledgeIngestView, RetrainKnowledgeView # Corrected import

urlpatterns = [
    path('v1/knowledge/ingest', KnowledgeIngestView.as_view(), name='knowledge_ingest'),
    path('v1/knowledge/retrain', RetrainKnowledgeView.as_view(), name='knowledge_retrain'), # Added retrain endpoint
]


