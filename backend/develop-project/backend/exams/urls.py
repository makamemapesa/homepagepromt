from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExamMarkViewSet, ExamResultViewSet

router = DefaultRouter()
router.register("exam-marks", ExamMarkViewSet)
router.register("exam-results", ExamResultViewSet)

urlpatterns = [path("", include(router.urls))]
