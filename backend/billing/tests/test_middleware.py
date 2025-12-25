from django.test import TestCase, Client
from django.urls import path
from django.http import HttpResponse
from django.test.utils import override_settings
from unittest.mock import patch
import time
import uuid

def dummy_view(request):
    return HttpResponse("OK")

urlpatterns = [
    path('api/v1/ai/chat', dummy_view, name='dummy_chat'),
]

class MockAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.user_id = uuid.uuid4()
        request.workspace_id = 'test_workspace'
        request.auth = 'dummy_jwt'
        response = self.get_response(request)
        return response

@override_settings(
    ROOT_URLCONF=__name__,
    MIDDLEWARE=[
        'django.contrib.sessions.middleware.SessionMiddleware',
        'django.middleware.common.CommonMiddleware',
        'django.contrib.auth.middleware.AuthenticationMiddleware',
        'backend.billing.tests.test_middleware.MockAuthMiddleware',
        'backend.billing.middleware.BillingMiddleware',
    ]
)
class BillingMiddlewareTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.url = reverse('dummy_chat')

    @patch('billing.rate_limit.RATE_LIMIT_STORE', {})
    def test_rate_limiting(self):
        """
        Ensure that the billing middleware enforces rate limiting.
        """
        for i in range(60):
            response = self.client.post(self.url)
            self.assertEqual(response.status_code, 200)
        
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, 429)

    # Note: A test for credit deduction would be more complex and require
    # mocking the Supabase repo and its return values.
    # For this stage, a rate limit test is a good baseline.