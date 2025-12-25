from django.test import TestCase, Client
from django.urls import reverse
import json

class ExternalAgentRunAPITest(TestCase):
    def setUp(self):
        self.client = Client()
        self.url = reverse('external_agent_run') # Assuming the url name is 'external_agent_run'

    def test_external_agent_run_api_no_key(self):
        """
        Ensure that the external agent run API returns 401 Unauthorized when no API key is provided.
        """
        response = self.client.post(self.url, {}, content_type='application/json')
        self.assertEqual(response.status_code, 401)
