from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views
from .views import CompanyViewSet

router = DefaultRouter()
router.register(r'companies', CompanyViewSet, basename='company')

urlpatterns = [
    path('companies/<int:company_id>/mobile-reviews/', views.mobile_company_reviews),
    router.urls
]