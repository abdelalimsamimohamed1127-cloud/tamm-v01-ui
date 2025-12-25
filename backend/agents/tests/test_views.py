from django.test import TestCase, Client
from django.urls import reverse
import json

class ChatAPITest(TestCase):
    def setUp(self):
        self.client = Client()
        self.url = reverse('ai_chat')

    def test_chat_api_no_token(self):
        """
        Ensure that the chat API returns 401 Unauthorized when no token is provided.
        """
        response = self.client.post(self.url, {}, content_type='application/json')
        self.assertEqual(response.status_code, 401)
