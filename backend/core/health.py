"""
Health check endpoint for the Tamm application.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .metrics import get_metrics

class HealthCheckView(APIView):
    """
    Provides a basic health check endpoint.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, *args, **kwargs):
        # Here you could add checks for database connectivity,
        # cache reachability, or other critical services.
        # For now, a simple "OK" is sufficient.
        health_status = {
            'status': 'ok',
            'services': {
                'django': 'ok',
                # 'database': 'ok', # Example for a future check
                # 'cache': 'ok',    # Example for a future check
            }
        }
        return Response(health_status, status=status.HTTP_200_OK)

class MetricsView(APIView):
    """
    Exposes the internal metrics.
    In a real production environment, this endpoint should be
    scraped by a Prometheus server and probably protected.
    """
    authentication_classes = [] # Should be restricted in production
    permission_classes = []   # Should be restricted in production

    def get(self, request, *args, **kwargs):
        """
        Returns a snapshot of the current in-memory metrics.
        """
        return Response(get_metrics(), status=status.HTTP_200_OK)
