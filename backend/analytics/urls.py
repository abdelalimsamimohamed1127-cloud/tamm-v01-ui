from django.urls import path
from analytics.views import AnalyticsOverviewAPIView, AnalyticsTimeseriesAPIView, AnalyticsBreakdownAPIView, InsightsAPIView

urlpatterns = [
    path('v1/analytics/overview', AnalyticsOverviewAPIView.as_view(), name='analytics_overview'),
    path('v1/analytics/timeseries', AnalyticsTimeseriesAPIView.as_view(), name='analytics_timeseries'),
    path('v1/analytics/breakdown', AnalyticsBreakdownAPIView.as_view(), name='analytics_breakdown'),
    path('v1/analytics/insights', InsightsAPIView.as_view(), name='analytics_insights'),
]
