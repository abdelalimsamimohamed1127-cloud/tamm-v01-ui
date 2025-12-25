# backend/webchat/urls.py
from django.urls import path
from .views import WebchatMessageView

# The user has not specified the view name, I will assume WebchatMessageView
urlpatterns = [
    path('message', WebchatMessageView.as_view(), name='webchat-message'),
]
