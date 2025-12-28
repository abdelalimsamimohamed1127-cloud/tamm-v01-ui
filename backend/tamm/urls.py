"""
tamm URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')), # Include URLs from our core app
    path('api/', include('agents.urls')), # Include URLs from our agents app
    path('api/', include('knowledge.urls')), # Include URLs from our knowledge app
    path('api/', include('channels.urls')), # Include URLs from our channels app
    path('api/', include('analytics.urls')), # Include URLs from our analytics app
    path('api/', include('copilot.urls')), # Our copilot application
    path('api/', include('integrations.urls')), # Include URLs from our integrations app
    path('api/v1/external/', include('external_api.urls')), # Include URLs from our external_api app
    path('api/', include('billing.urls')), # Include URLs from our billing app
    path('api/v1/webchat/', include('webchat.urls')), # Include URLs from our new webchat app
]
