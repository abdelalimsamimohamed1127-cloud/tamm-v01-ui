from django.test import TestCase, Client
from django.urls import reverse
import json

class AnalyticsOverviewAPITest(TestCase):
    def setUp(self):
        self.client = Client()
        self.url = reverse('analytics_overview') # Assuming the url name is 'analytics_overview'

    def test_analytics_overview_api_no_token(self):
        """
        Ensure that the analytics overview API returns 401 Unauthorized when no token is provided.
        """
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)
