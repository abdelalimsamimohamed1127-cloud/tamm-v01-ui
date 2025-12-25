from django.urls import path
from channels.views import ChannelEventAPIView, ChannelSendAPIView

urlpatterns = [
    path('v1/channels/event', ChannelEventAPIView.as_view(), name='channel_event'),
    path('v1/channels/send', ChannelSendAPIView.as_view(), name='channel_send'),
]
