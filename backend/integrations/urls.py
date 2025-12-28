from django.urls import path
from integrations.views import ConnectorAPIView, SyncConnectorAPIView # Import SyncConnectorAPIView

urlpatterns = [
    path('v1/integrations/connectors', ConnectorAPIView.as_view(), name='connectors_list_create'),
    path('v1/integrations/connectors/<uuid:connector_id>/sync', SyncConnectorAPIView.as_view(), name='connector_sync'),
]
