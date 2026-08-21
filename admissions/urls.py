from rest_framework.routers import DefaultRouter
from .views import AdmissionWindowViewSet, ApplicantViewSet

router = DefaultRouter()
router.register(r"admission-windows", AdmissionWindowViewSet, basename="admission-window")
router.register(r"applicants", ApplicantViewSet, basename="applicant")

urlpatterns = router.urls
