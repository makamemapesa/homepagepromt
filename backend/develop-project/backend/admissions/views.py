import secrets
import string

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import transaction

from core.permissions import IsSuperAdminOrAdmin
from core.models import UserProfile
from core.throttles import PublicApplicationThrottle
from .models import AdmissionWindow, Applicant, ApplicationPayment, Interview
from .serializers import (
    AdmissionWindowSerializer,
    ApplicantListSerializer,
    ApplicantDetailSerializer,
    ApplicationPaymentSerializer,
    InterviewSerializer,
    PublicApplicantCreateSerializer,
)
from students.models import Student
from academics.models import Class


def _get_or_create_parent_account(parent_name: str, parent_email: str, parent_phone: str):
    """
    Auto-create a parent User account with a secure random temporary password.
    Username  = email (lowercased)
    Password  = cryptographically random 12-character string
    Returns (user, created, default_password)
    """
    email = parent_email.strip().lower()

    existing = User.objects.filter(username=email).first()
    if existing:
        return existing, False, None  # account already exists, don't leak password

    # Generate a secure random password (letters + digits, 12 chars)
    alphabet = string.ascii_letters + string.digits
    default_password = "".join(secrets.choice(alphabet) for _ in range(12))

    # Split full name into first/last
    parts = parent_name.strip().split()
    fn = parts[0] if parts else parent_name
    ln = " ".join(parts[1:]) if len(parts) > 1 else ""

    with transaction.atomic():
        user = User.objects.create_user(
            username=email,
            email=email,
            password=default_password,
            first_name=fn,
            last_name=ln,
        )
        UserProfile.objects.create(user=user, role="parent")

    return user, True, default_password


class AdmissionWindowViewSet(viewsets.ModelViewSet):
    """Manage application windows (admin only)."""
    queryset = AdmissionWindow.objects.all()
    serializer_class = AdmissionWindowSerializer
    permission_classes = [IsSuperAdminOrAdmin]

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def active(self, request):
        """Public endpoint: returns the currently open window (if any)."""
        today = timezone.now().date()
        window = AdmissionWindow.objects.filter(
            is_active=True,
            open_date__lte=today,
            close_date__gte=today,
        ).first()
        if window:
            return Response(AdmissionWindowSerializer(window).data)
        return Response({"detail": "No active application window."}, status=status.HTTP_404_NOT_FOUND)


class ApplicantViewSet(viewsets.ModelViewSet):
    queryset = Applicant.objects.select_related("payment", "interview", "window").all()
    permission_classes = [IsSuperAdminOrAdmin]

    def get_serializer_class(self):
        if self.action == "list":
            return ApplicantListSerializer
        if self.action == "create" and not self.request.user.is_authenticated:
            return PublicApplicantCreateSerializer
        return ApplicantDetailSerializer

    def get_permissions(self):
        # Allow unauthenticated POST (public application form)
        # Allow authenticated parents to view their own applications
        if self.action in ("create", "my_applications"):
            return [AllowAny()]
        return [IsSuperAdminOrAdmin()]

    def get_throttles(self):
        # Rate-limit the public application submission to prevent spam
        if self.action == "create" and not self.request.user.is_authenticated:
            return [PublicApplicationThrottle()]
        return super().get_throttles()

    def perform_create(self, serializer):
        """
        Save the application and link it to the correct parent account.

        - Authenticated request (parent logged in via portal): use request.user directly.
          No new account is created; all their applications share the same account.
        - Anonymous request (public /apply page): look up or create an account by email,
          then return the default password so the success screen can display it.
        """
        parent_email = serializer.validated_data.get("parent_email", "").strip()
        parent_name = serializer.validated_data.get("parent_name", "").strip()
        parent_phone = serializer.validated_data.get("parent_phone", "").strip()

        account_created = False
        default_password = None
        parent_user = None

        if self.request.user.is_authenticated:
            # Portal submission — link directly to the logged-in user
            parent_user = self.request.user
        elif parent_email:
            # Public form — get or create an account by email
            parent_user, account_created, default_password = _get_or_create_parent_account(
                parent_name, parent_email, parent_phone
            )

        applicant = serializer.save(
            parent_user=parent_user,
            status="submitted",
        )
        # Attach account info so the response can show it to the parent
        applicant._account_created = account_created
        applicant._default_password = default_password
        applicant._account_email = parent_email

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        applicant = serializer.instance

        response_data = ApplicantDetailSerializer(applicant).data
        response_data["account_created"] = getattr(applicant, "_account_created", False)
        response_data["account_email"] = getattr(applicant, "_account_email", None)
        response_data["default_password"] = getattr(applicant, "_default_password", None)

        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="my-applications", permission_classes=[IsAuthenticated])
    def my_applications(self, request):
        """Parents can view their own submitted applications."""
        apps = Applicant.objects.filter(parent_user=request.user).select_related("payment", "interview")
        serializer = ApplicantDetailSerializer(apps, many=True)
        return Response({"results": serializer.data})

    # ── Payment ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="confirm-payment")
    def confirm_payment(self, request, pk=None):
        applicant = self.get_object()
        serializer = ApplicationPaymentSerializer(data={
            **request.data,
            "applicant": applicant.id,
        })
        if serializer.is_valid():
            serializer.save(confirmed_by=request.user)
            applicant.status = "payment_confirmed"
            applicant.save()
            return Response(ApplicantDetailSerializer(applicant).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # ── Interview scheduling ──────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="schedule-interview")
    def schedule_interview(self, request, pk=None):
        applicant = self.get_object()
        data = {**request.data, "applicant": applicant.id}
        existing = getattr(applicant, "interview", None)
        if existing:
            serializer = InterviewSerializer(existing, data=data, partial=True)
        else:
            serializer = InterviewSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            applicant.status = "interview_scheduled"
            applicant.save()
            return Response(ApplicantDetailSerializer(applicant).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # ── Record interview result ───────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="record-result")
    def record_result(self, request, pk=None):
        applicant = self.get_object()
        interview = getattr(applicant, "interview", None)
        if not interview:
            return Response({"detail": "No interview scheduled."}, status=status.HTTP_400_BAD_REQUEST)
        result = request.data.get("result")  # "accepted" or "declined"
        marks = request.data.get("marks")
        remarks = request.data.get("remarks", "")
        if result not in ("accepted", "declined"):
            return Response({"detail": "result must be 'accepted' or 'declined'."}, status=status.HTTP_400_BAD_REQUEST)
        interview.result = result
        if marks is not None:
            interview.marks = marks
        interview.remarks = remarks
        interview.save()
        applicant.status = result  # "accepted" or "declined"
        applicant.save()
        return Response(ApplicantDetailSerializer(applicant).data)

    # ── Enroll (convert accepted applicant to Student) ────────────────────────
    @action(detail=True, methods=["post"], url_path="enroll")
    def enroll(self, request, pk=None):
        applicant = self.get_object()
        if applicant.status != "accepted":
            return Response({"detail": "Only accepted applicants can be enrolled."}, status=status.HTTP_400_BAD_REQUEST)
        if applicant.enrolled_student:
            return Response({"detail": "Already enrolled."}, status=status.HTTP_400_BAD_REQUEST)

        reg_no = request.data.get("reg_no")
        class_id = request.data.get("student_class")
        admission_date = request.data.get("admission_date")

        if not reg_no or not admission_date:
            return Response({"detail": "reg_no and admission_date are required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            student = Student.objects.create(
                reg_no=reg_no,
                first_name=applicant.first_name,
                last_name=applicant.last_name,
                middle_name=applicant.middle_name,
                date_of_birth=applicant.date_of_birth,
                gender=applicant.gender,
                religion=applicant.religion,
                nationality=applicant.nationality,
                previous_school=applicant.previous_school,
                student_class_id=class_id if class_id else None,
                student_type=applicant.student_type,
                admission_date=admission_date,
                academic_session=applicant.academic_session,
                status="active",
                fee_status="unpaid",
            )
            applicant.enrolled_student = student
            applicant.status = "enrolled"
            applicant.save()

        from students.serializers import StudentDetailSerializer
        return Response({
            "applicant": ApplicantDetailSerializer(applicant).data,
            "student": StudentDetailSerializer(student, context={"request": request}).data,
        }, status=status.HTTP_201_CREATED)

    # ── Parent: view their own applications ───────────────────────────────────
    @action(detail=False, methods=["get"], url_path="my-applications")
    def my_applications(self, request):
        """
        Returns all applications submitted by the authenticated parent.
        Accessible to: authenticated parents (and admins for testing).
        Anonymous users receive an empty list.
        """
        if not request.user.is_authenticated:
            return Response([])
        qs = Applicant.objects.filter(parent_user=request.user).select_related(
            "payment", "interview", "window", "enrolled_student"
        ).order_by("-created_at")
        serializer = ApplicantDetailSerializer(qs, many=True)
        return Response(serializer.data)
