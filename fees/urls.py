from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FeeStructureViewSet, PaymentViewSet

router = DefaultRouter()
router.register("fees/structure", FeeStructureViewSet)
router.register("fees/payments", PaymentViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("fees/outstanding/", PaymentViewSet.as_view({"get": "outstanding"}), name="fees-outstanding"),
]
