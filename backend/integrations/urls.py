from django.urls import path
from integrations.views import ConnectorAPIView, IngestAPIView

urlpatterns = [
    path('v1/integrations/connectors', ConnectorAPIView.as_view(), name='create_connector'),
    path('v1/integrations/ingest', IngestAPIView.as_view(), name='ingest_data'),
]
