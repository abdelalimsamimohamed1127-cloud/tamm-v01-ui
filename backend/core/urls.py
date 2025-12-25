from django.urls import path
from core.health import HealthCheckView, MetricsView

urlpatterns = [
    path('health', HealthCheckView.as_view(), name='health_check'),
    path('metrics', MetricsView.as_view(), name='metrics'),
]
