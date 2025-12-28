from django.urls import path
from backend.billing import views

urlpatterns = [
    path('plans/', views.get_available_plans_api, name='get_available_plans'),
    path('plans/current/<str:workspace_id_str>/', views.get_current_workspace_plan_api, name='get_current_workspace_plan'),
    path('paymob/initiate-checkout/', views.initiate_paymob_checkout_api, name='initiate_paymob_checkout'),
    path('instapay/create-request/', views.create_instapay_payment_request_api, name='create_instapay_payment_request'),
    path('instapay/pending-requests/', views.get_pending_instapay_requests_api, name='get_pending_instapay_requests'), # Admin endpoint
    path('instapay/confirm-payment/', views.confirm_instapay_payment_api, name='confirm_instapay_payment'), # Admin endpoint
    path('instapay/reject-payment/', views.reject_instapay_payment_api, name='reject_instapay_payment'), # Admin endpoint
]