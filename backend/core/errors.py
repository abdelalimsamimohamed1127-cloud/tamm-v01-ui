"""
Standardized error responses for the Tamm API.
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Custom exception handler for Django Rest Framework.
    """
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    # Now, customize the response data.
    if response is not None:
        custom_response_data = {
            'error': {
                'status_code': response.status_code,
                'detail': response.data.get('detail', str(exc)),
                'code': response.data.get('code', 'error')
            }
        }
        response.data = custom_response_data
    else:
        # Handle exceptions not caught by DRF
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        custom_response_data = {
            'error': {
                'status_code': status.HTTP_500_INTERNAL_SERVER_ERROR,
                'detail': 'Internal Server Error. Our team has been notified.',
                'code': 'internal_error'
            }
        }
        response = Response(custom_response_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    # Do not leak stack traces in production
    # In DEBUG mode, you might want to include more details
    # from the original exception.
    # For now, we keep it simple and safe.

    return response

class APIError(Exception):
    """Base class for API errors."""
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = 'A server error occurred.'
    default_code = 'error'

    def __init__(self, detail=None, code=None):
        if detail is None:
            detail = self.default_detail
        if code is None:
            code = self.default_code

        self.detail = detail
        self.code = code

    def __str__(self):
        return self.detail

class AIAProviderError(APIError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'AI provider is currently unavailable. Please try again later.'
    default_code = 'ai_provider_failure'

class SupabaseUnavailableError(APIError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Database is currently unavailable. Please try again later.'
    default_code = 'database_unavailable'

class RateLimitExceededError(APIError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = 'Rate limit exceeded.'
    default_code = 'rate_limit_exceeded'

class InvalidAPIKeyError(APIError):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = 'Invalid API key.'
    default_code = 'invalid_api_key'

class PayloadTooLargeError(APIError):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    default_detail = 'Request payload is too large.'
    default_code = 'payload_too_large'

class UnknownFieldsError(APIError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Request contains unknown fields.'
    default_code = 'unknown_fields'
