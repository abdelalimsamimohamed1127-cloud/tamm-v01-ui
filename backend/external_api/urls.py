# backend/external_api/urls.py

from django.urls import path, include
from backend.external_api import views

urlpatterns = [
    # Internal API Key Management (for workspace admins, typically accessed via internal UI)
    path('api-keys/create/', views.create_workspace_api_key, name='create_workspace_api_key'),
    path('api-keys/revoke/<uuid:key_id>/', views.revoke_workspace_api_key, name='revoke_workspace_api_key'),
    path('api-keys/list/', views.list_workspace_api_keys, name='list_workspace_api_keys'),

    # External API Endpoints (accessed by external systems)
    path('events', views.external_events_view, name='external_events'),
    path('status', views.external_status_view, name='external_status'),
]