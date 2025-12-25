from django.urls import path
from external_api.views import ExternalAgentRunAPIView, ExternalEventsAPIView, ExternalDataIngestAPIView

urlpatterns = [
    path('v1/external/agent/run', ExternalAgentRunAPIView.as_view(), name='external_agent_run'),
    path('v1/external/events', ExternalEventsAPIView.as_view(), name='external_events'),
    path('v1/external/data/ingest', ExternalDataIngestAPIView.as_view(), name='external_data_ingest'),
]
