"""
In-process metrics collection for Prometheus-style monitoring.

This implementation is a lightweight, in-memory store for metrics
and does not require any external infrastructure. It's designed
to be simple and ready for a future Prometheus exporter.
"""

import time
from collections import defaultdict

# A simple in-memory store for metrics
_METRICS = {
    'request_count': defaultdict(int),
    'error_rate': defaultdict(int),
    'avg_latency': defaultdict(list),
    'ai_latency': defaultdict(list),
    'rate_limit_hits': defaultdict(int),
    'audit_log': defaultdict(int),
}

def metric_name(name, labels=None):
    """Creates a unique metric name from a name and labels."""
    if labels:
        # Sort labels to ensure consistent naming
        sorted_labels = sorted(labels.items())
        label_str = "_".join(f"{k}_{v}" for k, v in sorted_labels)
        return f"{name}_{label_str}"
    return name

def inc_counter(name, labels=None, value=1):
    """Increments a counter metric."""
    full_name = metric_name(name, labels)
    _METRICS[name][full_name] += value

def record_latency(name, labels=None, latency=0.0):
    """Records a latency value for averaging."""
    full_name = metric_name(name, labels)
    # We store a list of latencies to be averaged later.
    # For high-volume applications, a more sophisticated
    # histogram or summary object would be better.
    _METRICS[name][full_name].append(latency)

def get_metrics():
    """
    Returns a dictionary of all current metric values.
    This is what a Prometheus scraper would eventually call.
    """
    snapshot = {}
    for name, labels_map in _METRICS.items():
        if name in ['avg_latency', 'ai_latency']:
            for full_name, values in labels_map.items():
                if values:
                    avg = sum(values) / len(values)
                    snapshot[f"{full_name}_avg"] = avg
                    snapshot[f"{full_name}_count"] = len(values)
        else: # Counters
            for full_name, value in labels_map.items():
                snapshot[full_name] = value
    return snapshot

class MetricsMiddleware:
    """
    Middleware to capture basic request metrics.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()

        response = self.get_response(request)

        latency = time.time() - start_time
        
        # Get workspace_id if available on the request
        workspace_id = getattr(request, 'workspace_id', 'unknown')
        
        labels = {
            'endpoint': request.path,
            'method': request.method,
            'status_code': response.status_code,
            'workspace_id': workspace_id
        }

        inc_counter('request_count', labels)
        record_latency('avg_latency', labels, latency)

        if 400 <= response.status_code < 600:
            inc_counter('error_rate', labels)
            
        if response.status_code == 429:
            inc_counter('rate_limit_hits', {
                'endpoint': request.path,
                'workspace_id': workspace_id
            })

        return response
