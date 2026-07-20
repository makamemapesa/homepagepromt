from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DonorViewSet

router = DefaultRouter()
router.register("donors", DonorViewSet)

urlpatterns = [path("", include(router.urls))]
