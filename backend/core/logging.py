"""
Structured logging configuration for the Tamm application.
"""
import logging
import os
from pythonjsonlogger import jsonlogger

def setup_logging():
    """
    Configures structured JSON logging.
    """
    log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
    
    # Get the root logger
    logger = logging.getLogger()
    logger.setLevel(log_level)
    
    # Remove any existing handlers
    if logger.hasHandlers():
        logger.handlers.clear()

    # Create a handler that outputs to console
    log_handler = logging.StreamHandler()

    # Use a custom formatter
    formatter = jsonlogger.JsonFormatter(
        '%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d',
        rename_fields={
            'levelname': 'level',
            'asctime': 'timestamp'
        }
    )

    log_handler.setFormatter(formatter)
    logger.addHandler(log_handler)

    # Configure specific loggers to be less verbose if needed
    logging.getLogger('django').setLevel(os.environ.get('DJANGO_LOG_LEVEL', 'WARNING').upper())
    logging.getLogger('urllib3').setLevel(os.environ.get('URLLIB3_LOG_LEVEL', 'WARNING').upper())

class RequestIdMiddleware:
    """
    Injects a request_id into every log message.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # You would ideally generate a unique ID here.
        # For simplicity, we'll use a placeholder or a simple counter if needed.
        # A good library for this is `uuid`.
        import uuid
        request.request_id = str(uuid.uuid4())

        response = self.get_response(request)

        # You can also log the response here if needed
        return response

def get_request_id(request):
    """Utility to get request_id from a request object."""
    return getattr(request, 'request_id', 'no-request-id')

def get_workspace_id(request):
    """
    Utility to get workspace_id from a request.
    This is a placeholder. You need to implement the logic
    to extract the workspace_id from the request, probably
    after the authentication middleware has run.
    """
    # This might come from request.user.workspace, request.session, or a header.
    # Example placeholder:
    workspace = getattr(request, 'workspace', None)
    if workspace:
        return workspace.id
    return 'no-workspace-id'
