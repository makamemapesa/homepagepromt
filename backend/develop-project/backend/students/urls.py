from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentViewSet, AcademicHistoryViewSet

router = DefaultRouter()
router.register("students", StudentViewSet)
router.register("academic-history", AcademicHistoryViewSet)

urlpatterns = [path("", include(router.urls))]
