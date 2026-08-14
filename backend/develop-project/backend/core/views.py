from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import User
from django.db import models
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import UserProfile, SchoolSettings, Notification, AuditLog, TeamMember, CEOMessage, Fundraiser, Donation, HomePageContent
from .permissions import IsSuperAdmin, IsSuperAdminOrAdmin, IsAccountantOrAdmin
from .utils import get_user_role
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    SchoolSettingsSerializer,
    HomePageContentSerializer,
    NotificationSerializer,
    AuditLogSerializer,
    TeamMemberSerializer,
    CEOMessageSerializer,
    FundraiserSerializer,
    DonationSerializer,
)


class UserViewSet(viewsets.ModelViewSet):
    """
    User management - Only Super Admins can create/update/delete users.
    All authenticated users can view the 'me' endpoint.
    """
    queryset = User.objects.select_related("profile").prefetch_related("guardian_records").all().order_by("first_name")
    permission_classes = [IsSuperAdmin]
    filter_backends = [SearchFilter]
    search_fields = ["first_name", "last_name", "email", "profile__role"]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            return UserUpdateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        """Create user and return full serialized data including id and role."""
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update user and return full serialized data including updated role."""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = UserUpdateSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        user.refresh_from_db()
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        """Super Admin can reset any user's password."""
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        
        user = self.get_object()
        password = request.data.get("password", "")
        
        # Validate password against Django's validators
        try:
            validate_password(password, user=user)
        except DjangoValidationError as e:
            return Response(
                {"error": list(e.messages)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.set_password(password)
        user.save()
        return Response({"status": "Password updated successfully."})

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Any authenticated user can view their own profile."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class HomePageContentView(generics.RetrieveUpdateAPIView):
    queryset = HomePageContent.objects.all()
    serializer_class = HomePageContentSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_object(self):
        obj, _ = HomePageContent.objects.get_or_create(pk=1)
        return obj

    def get_permissions(self):
        if self.request.method in {"GET", "HEAD", "OPTIONS"}:
            return [AllowAny()]
        return [IsSuperAdminOrAdmin()]

    def update(self, request, *args, **kwargs):
        # Accept hero_image in both snake_case and camelCase from frontend
        if request.data.get("heroImage") and not request.data.get("hero_image"):
            data = request.data.copy()
            data["hero_image"] = data.get("heroImage")
            request._full_data = data
        return super().update(request, *args, **kwargs)


class SchoolSettingsViewSet(viewsets.ViewSet):
    """
    School settings - All authenticated users can view, only Admins can modify.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """All users can view school settings."""
        obj, _ = SchoolSettings.objects.get_or_create(pk=1)
        return Response(SchoolSettingsSerializer(obj).data)

    def update(self, request, pk=None):
        """Only Super Admin or Admin can update school settings."""
        role = get_user_role(request.user)
        if role not in ['super_admin', 'admin']:
            return Response(
                {"error": "Only administrators can update school settings."},
                status=status.HTTP_403_FORBIDDEN
            )
        obj, _ = SchoolSettings.objects.get_or_create(pk=1)
        serializer = SchoolSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["type", "read"]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter notifications: admins see system-wide + their own; others see only theirs."""
        user = self.request.user
        role = get_user_role(user)
        
        if role in ['super_admin', 'admin', 'accountant']:
            # Admins/accountants see system-wide (null recipient) OR notifications assigned to them
            return Notification.objects.filter(models.Q(recipient__isnull=True) | models.Q(recipient=user))
        else:
            # Teachers, parents see only notifications specifically assigned to them
            return Notification.objects.filter(recipient=user)

    def create(self, request, *args, **kwargs):
        """Create notification. If no recipient specified, it's system-wide (admins/accountants only)."""
        # Recipient is optional - null means system-wide notification for admins
        # If student_id is provided, look up the parent and set as recipient
        student_id = request.data.get('student_id')
        if student_id:
            from students.models import Student
            try:
                student = Student.objects.select_related('parent__user').get(pk=student_id)
                if student.parent and student.parent.user:
                    # Create a copy of request.data to modify
                    data = request.data.copy()
                    data['recipient'] = student.parent.user.id
                    serializer = self.get_serializer(data=data)
                    serializer.is_valid(raise_exception=True)
                    self.perform_create(serializer)
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Student.DoesNotExist:
                pass
        # No student_id or student not found - create as system-wide notification
        return super().create(request, *args, **kwargs)

    def get_permissions(self):
        """Admins/accountants can create notifications; only Admins can delete; all authenticated users can read/mark."""
        if self.action in ["destroy", "clear_all", "dismiss"]:
            return [IsSuperAdminOrAdmin()]
        if self.action in ["create"]:
            return [IsAccountantOrAdmin()]
        return [IsAuthenticated()]

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        # Only mark the user's own notifications as read
        self.get_queryset().filter(read=False).update(read=True)
        return Response({"status": "all marked read"})

    @action(detail=False, methods=["delete"])
    def clear_all(self, request):
        # Only clear the user's own notifications
        self.get_queryset().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["patch"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.read = True
        notif.save()
        return Response(NotificationSerializer(notif).data)

    @action(detail=True, methods=["delete"])
    def dismiss(self, request, pk=None):
        """Dismiss (delete) a single notification."""
        notif = self.get_object()
        notif.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Audit logs - Only Super Admins can view audit logs.
    """
    queryset = AuditLog.objects.select_related("user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsSuperAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["action", "module", "status"]
    search_fields = ["user__first_name", "user__last_name", "detail"]


class DashboardStatsView(generics.RetrieveAPIView):
    """
    Dashboard statistics - Filtered based on user role.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from students.models import Student
        from academics.models import Teacher, Class
        from fees.models import Payment

        user = request.user
        role = get_user_role(user)

        # Role-based data filtering
        if role == 'accountant':
            # Accountants see financial data + total students/classes for context
            from django.db.models import Sum
            from students.models import Student
            from academics.models import Teacher, Class
            total_revenue = Payment.objects.filter(status="confirmed").aggregate(total=Sum("amount"))["total"] or 0
            pending_fees = Payment.objects.filter(status="pending").aggregate(total=Sum("amount"))["total"] or 0
            total_students = Student.objects.filter(status="active").count()
            total_classes = Class.objects.filter(status="active").count()

            return Response({
                "totalStudents": total_students,
                "totalTeachers": 0,
                "totalClasses": total_classes,
                "totalRevenue": float(total_revenue),
                "pendingFees": float(pending_fees),
            })
        
        elif role == 'teacher':
            # Teachers see only their class statistics (homeroom + assigned)
            from academics.models import Teacher as TeacherModel, Class, TeacherAssignment
            try:
                teacher = TeacherModel.objects.get(email=user.email)
                homeroom_ids = set(Class.objects.filter(class_teacher=teacher).values_list('id', flat=True))
                assigned_ids = set(TeacherAssignment.objects.filter(teacher=teacher, status='active').values_list('student_class_id', flat=True))
                all_ids = homeroom_ids | assigned_ids
                total_students = Student.objects.filter(
                    student_class_id__in=all_ids,
                    status="active"
                ).count()
                total_classes = len(all_ids)
            except TeacherModel.DoesNotExist:
                total_students = 0
                total_classes = 0
            
            return Response({
                "totalStudents": total_students,
                "totalTeachers": 1,
                "totalClasses": total_classes,
                "totalRevenue": 0,
                "pendingFees": 0,
            })
        
        elif role == 'parent':
            # Parents see only their children's data
            total_students = Student.objects.filter(
                parent__user=user,
                status="active"
            ).count()
            
            return Response({
                "totalStudents": total_students,
                "totalTeachers": 0,
                "totalClasses": 0,
                "totalRevenue": 0,
                "pendingFees": 0,
            })
        
        # Super Admin and Admin see everything
        from django.db.models import Sum
        total_students = Student.objects.filter(status="active").count()
        total_teachers = Teacher.objects.filter(status="active").count()
        total_classes = Class.objects.filter(status="active").count()
        total_revenue = Payment.objects.filter(status="confirmed").aggregate(total=Sum("amount"))["total"] or 0
        pending_fees = Payment.objects.filter(status="pending").aggregate(total=Sum("amount"))["total"] or 0

        return Response({
            "totalStudents": total_students,
            "totalTeachers": total_teachers,
            "totalClasses": total_classes,
            "totalRevenue": float(total_revenue),
            "pendingFees": float(pending_fees),
        })


class PendingParentsView(generics.ListAPIView):
    """
    Returns ParentGuardian records that have no linked login account (user=null).
    Used by User Management to show parents who still need a login account.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = get_user_role(request.user)
        if role not in ("super_admin", "admin"):
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
        from students.models import ParentGuardian

        # Auto-heal: link any unlinked guardian records whose phone already
        # matches a linked guardian (same parent, multiple children scenario).
        linked_map = {}
        for phone, user_id in (
            ParentGuardian.objects
            .filter(user__isnull=False, phone__isnull=False)
            .exclude(phone="")
            .values_list("phone", "user")
        ):
            if phone not in linked_map:
                linked_map[phone] = user_id
        for phone, user_id in linked_map.items():
            ParentGuardian.objects.filter(user__isnull=True, phone=phone).update(user_id=user_id)

        qs = ParentGuardian.objects.filter(user__isnull=True).select_related("student")
        data = [
            {
                "id": pg.id,
                "full_name": pg.full_name,
                "phone": pg.phone,
                "email": pg.email or "",
                "relationship": pg.relationship,
                "student_id": pg.student_id,
                "student_name": pg.student.full_name if pg.student else "",
                "student_reg_no": pg.student.reg_no if pg.student else "",
            }
            for pg in qs
        ]
        return Response(data)


class PendingParentDeleteView(generics.DestroyAPIView):
    """
    Delete a specific pending parent record (and their student) by ParentGuardian id.
    Only admins can do this.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        role = get_user_role(request.user)
        if role not in ("super_admin", "admin"):
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
        from students.models import ParentGuardian
        try:
            pg = ParentGuardian.objects.select_related("student").get(pk=pk)
            pg.student.delete()  # CASCADE deletes the ParentGuardian too
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ParentGuardian.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)


class ParentDashboardView(generics.RetrieveAPIView):
    """
    Parent portal - returns the linked student's full data including
    payments and exam results. Only accessible by users with role='parent'.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)
        if not profile or profile.role != "parent":
            return Response({"error": "Access denied. Parent role required."}, status=status.HTTP_403_FORBIDDEN)

        # Find all students linked to this parent via ParentGuardian.user
        from students.models import Student
        students_qs = Student.objects.filter(parent__user=request.user).select_related("student_class", "donor")
        if not students_qs.exists():
            return Response({"error": "No student linked to this parent account. Please contact the administrator."}, status=status.HTTP_404_NOT_FOUND)

        from students.serializers import StudentDetailSerializer
        from fees.models import Payment
        from fees.serializers import PaymentSerializer
        from exams.models import ExamResult
        from exams.serializers import ExamResultSerializer

        children = []
        for student in students_qs:
            student_data = StudentDetailSerializer(student, context={"request": request}).data
            payments = Payment.objects.filter(student=student).order_by("-date")
            payment_data = PaymentSerializer(payments, many=True).data
            results = ExamResult.objects.filter(student=student).prefetch_related("subject_results__subject").order_by("-academic_session", "term")
            result_data = ExamResultSerializer(results, many=True).data
            total_paid = sum(float(p["amount"]) for p in payment_data if p.get("status") == "confirmed")
            pending = sum(float(p["amount"]) for p in payment_data if p.get("status") == "pending")
            children.append({
                "student": student_data,
                "payments": payment_data,
                "results": result_data,
                "summary": {
                    "totalPaid": total_paid,
                    "pendingAmount": pending,
                    "paymentCount": len(payment_data),
                    "feeStatus": student.fee_status,
                },
            })

        return Response({"children": children})


class ParentAttendanceView(generics.RetrieveAPIView):
    """
    Returns per-student attendance records for the logged-in parent.
    Optional ?student_id=<id> to filter to one child.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)
        if not profile or profile.role != "parent":
            return Response({"error": "Access denied. Parent role required."}, status=status.HTTP_403_FORBIDDEN)

        from students.models import Student
        from academics.models import StudentAttendance

        students_qs = Student.objects.filter(parent__user=request.user).select_related("student_class")
        if not students_qs.exists():
            return Response({"error": "No student linked to this account."}, status=status.HTTP_404_NOT_FOUND)

        student_id = request.query_params.get("student_id")
        if student_id:
            students_qs = students_qs.filter(id=student_id)

        result = []
        for student in students_qs:
            records = (
                StudentAttendance.objects
                .filter(student=student)
                .order_by("-date")
                .values("date", "status", "note")
            )
            total = records.count()
            present = records.filter(status="present").count()
            absent = records.filter(status="absent").count()
            late = records.filter(status="late").count()
            result.append({
                "studentId": student.id,
                "studentName": student.full_name,
                "className": student.student_class.name if student.student_class else "",
                "summary": {
                    "total": total,
                    "present": present,
                    "absent": absent,
                    "late": late,
                    "rate": round((present / total) * 100, 1) if total else 0,
                },
                "records": list(records[:90]),  # last 90 records
            })

        return Response({"children": result})


class ParentTimetableView(generics.RetrieveAPIView):
    """
    Returns the timetable for classes linked to the logged-in parent's children.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)
        if not profile or profile.role != "parent":
            return Response({"error": "Access denied. Parent role required."}, status=status.HTTP_403_FORBIDDEN)

        from students.models import Student
        from academics.models import Timetable
        from academics.serializers import TimetableSerializer

        students_qs = Student.objects.filter(parent__user=request.user).select_related("student_class")
        if not students_qs.exists():
            return Response({"error": "No student linked to this account."}, status=status.HTTP_404_NOT_FOUND)

        result = []
        for student in students_qs:
            if not student.student_class:
                continue
            slots = Timetable.objects.filter(
                student_class=student.student_class
            ).select_related("subject", "teacher", "student_class").order_by("day", "period")
            result.append({
                "studentId": student.id,
                "studentName": student.full_name,
                "className": student.student_class.name,
                "slots": TimetableSerializer(slots, many=True).data,
            })

        return Response({"children": result})


class MessageListView(generics.ListCreateAPIView):
    """
    GET  /api/messages/           — list conversations (thread partners)
    POST /api/messages/           — send a new message
    GET  /api/messages/?thread=<user_id>  — messages in a thread
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.models import Message
        thread_id = request.query_params.get("thread")
        if thread_id:
            # Return thread between current user and partner
            from django.db.models import Q
            msgs = Message.objects.filter(
                (Q(sender=request.user) & Q(recipient_id=thread_id)) |
                (Q(recipient=request.user) & Q(sender_id=thread_id))
            ).order_by("created_at").select_related("sender", "recipient",
                                                      "sender__profile", "recipient__profile")
            # Mark received as read
            msgs.filter(recipient=request.user, read=False).update(read=True)
            data = [
                {
                    "id": m.id,
                    "senderId": m.sender.id,
                    "senderName": m.sender.get_full_name() or m.sender.username,
                    "senderRole": getattr(m.sender, "profile", None) and m.sender.profile.role,
                    "recipientId": m.recipient.id,
                    "recipientName": m.recipient.get_full_name() or m.recipient.username,
                    "body": m.body,
                    "read": m.read,
                    "createdAt": m.created_at.isoformat(),
                }
                for m in msgs
            ]
            return Response(data)
        else:
            # Return list of conversation threads
            from django.db.models import Q, Max
            from django.contrib.auth.models import User as AuthUser
            from core.models import Message
            sent = Message.objects.filter(sender=request.user).values_list("recipient_id", flat=True).distinct()
            received = Message.objects.filter(recipient=request.user).values_list("sender_id", flat=True).distinct()
            partner_ids = set(list(sent) + list(received))

            threads = []
            for pid in partner_ids:
                try:
                    partner = AuthUser.objects.select_related("profile").get(id=pid)
                except AuthUser.DoesNotExist:
                    continue
                last_msg = Message.objects.filter(
                    (Q(sender=request.user) & Q(recipient_id=pid)) |
                    (Q(recipient=request.user) & Q(sender_id=pid))
                ).order_by("-created_at").first()
                unread = Message.objects.filter(recipient=request.user, sender_id=pid, read=False).count()
                threads.append({
                    "partnerId": partner.id,
                    "partnerName": partner.get_full_name() or partner.username,
                    "partnerRole": get_user_role(partner),
                    "lastMessage": last_msg.body[:80] if last_msg else "",
                    "lastAt": last_msg.created_at.isoformat() if last_msg else "",
                    "unread": unread,
                })
            threads.sort(key=lambda x: x["lastAt"], reverse=True)
            return Response(threads)

    def post(self, request):
        from core.models import Message
        from django.contrib.auth.models import User as AuthUser
        recipient_id = request.data.get("recipientId")
        body = (request.data.get("body") or "").strip()
        if not recipient_id or not body:
            return Response({"error": "recipientId and body are required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(body) > 2000:
            return Response({"error": "Message too long (max 2000 chars)."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            recipient = AuthUser.objects.get(id=recipient_id)
        except AuthUser.DoesNotExist:
            return Response({"error": "Recipient not found."}, status=status.HTTP_404_NOT_FOUND)
        # Parents can only message teachers/admins, teachers/admins can message parents
        role = get_user_role(request.user)
        recipient_role = get_user_role(recipient)
        allowed_pairs = {
            "parent": ("teacher", "admin", "super_admin"),
            "teacher": ("parent", "admin", "super_admin"),
            "admin": ("parent", "teacher", "super_admin"),
            "super_admin": ("parent", "teacher", "admin"),
        }
        if recipient_role not in allowed_pairs.get(role, ()):
            return Response({"error": "You are not allowed to message this user."}, status=status.HTTP_403_FORBIDDEN)
        msg = Message.objects.create(sender=request.user, recipient=recipient, body=body)
        return Response({
            "id": msg.id,
            "senderId": msg.sender.id,
            "senderName": msg.sender.get_full_name() or msg.sender.username,
            "recipientId": msg.recipient.id,
            "body": msg.body,
            "read": msg.read,
            "createdAt": msg.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


class MessageContactsView(generics.ListAPIView):
    """
    GET /api/messages/contacts/
    Returns a list of users the current user is allowed to message.
    - Parents see: all teachers + admins
    - Teachers see: all parents (of students in their class) + admins
    - Admins see: all parents + teachers
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.contrib.auth.models import User as AuthUser
        role = get_user_role(request.user)
        if not role:
            return Response([])

        if role == "parent":
            target_roles = ["teacher", "admin", "super_admin"]
        elif role == "teacher":
            target_roles = ["parent", "admin", "super_admin"]
        else:
            target_roles = ["parent", "teacher"]

        users = AuthUser.objects.filter(
            profile__role__in=target_roles
        ).select_related("profile").exclude(id=request.user.id)

        data = [
            {
                "id": u.id,
                "name": u.get_full_name() or u.username,
                "role": get_user_role(u),
                "email": u.email,
            }
            for u in users
        ]
        return Response(data)


class ReportChartsView(generics.RetrieveAPIView):
    """
    Chart data for reports page - enrollment, revenue, performance, attendance.
    Accepts ?term=Term+2%2C+2025%2F2026 to filter performance data.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import datetime
        import calendar as _cal
        from django.db.models import Sum, Avg
        from students.models import Student
        from fees.models import Payment
        from exams.models import ExamMark
        from academics.models import Subject, Attendance, Teacher as TeacherModel, Class

        # Role check — parents cannot access school-wide chart data
        role = getattr(getattr(request.user, "profile", None), "role", None)
        if role == "parent":
            return Response({"error": "Access denied."}, status=403)

        is_privileged = role in ("super_admin", "admin", "accountant")
        
        # For teachers, get their assigned classes (homeroom + subject-assigned)
        teacher_class_ids = None
        if role == "teacher":
            try:
                from academics.models import TeacherAssignment
                teacher = TeacherModel.objects.get(email=request.user.email)
                homeroom_ids = set(Class.objects.filter(class_teacher=teacher).values_list('id', flat=True))
                assigned_ids = set(TeacherAssignment.objects.filter(teacher=teacher, status='active').values_list('student_class_id', flat=True))
                teacher_class_ids = homeroom_ids | assigned_ids
            except TeacherModel.DoesNotExist:
                teacher_class_ids = set()

        # Parse full term string e.g. "Term 2, 2025/2026"
        # ExamMark.term stores the FULL string ("Term 2, 2025/2026") as entered by the marks page
        term_param = request.query_params.get("term", "")
        if not term_param:
            today_year = datetime.date.today().year
            if datetime.date.today().month >= 9:
                session_part = f"{today_year}/{today_year + 1}"
            else:
                session_part = f"{today_year - 1}/{today_year}"
            term_param = f"Term 2, {session_part}"

        today = datetime.date.today()

        # Enrollment trend — last 6 real calendar months
        enrollment_data = []
        for i in range(5, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            last_day = _cal.monthrange(y, m)[1]
            month_end = datetime.date(y, m, last_day)
            if teacher_class_ids is not None:
                # Teachers: only students in their assigned classes
                count = Student.objects.filter(
                    admission_date__lte=month_end,
                    status="active",
                    student_class_id__in=teacher_class_ids
                ).count()
            else:
                # Admins/accountants: all students
                count = Student.objects.filter(admission_date__lte=month_end, status="active").count()
            enrollment_data.append({"month": month_end.strftime("%b"), "students": count})

        # Revenue data — last 6 real calendar months (admins/accountants only)
        revenue_data = []
        if is_privileged:
            for i in range(5, -1, -1):
                m = today.month - i
                y = today.year
                while m <= 0:
                    m += 12
                    y -= 1
                month_start = datetime.date(y, m, 1)
                month_end = datetime.date(y, m, _cal.monthrange(y, m)[1])
                collected = Payment.objects.filter(
                    date__gte=month_start, date__lte=month_end, status="confirmed"
                ).aggregate(total=Sum("amount"))["total"] or 0
                pending = Payment.objects.filter(
                    date__gte=month_start, date__lte=month_end, status="pending"
                ).aggregate(total=Sum("amount"))["total"] or 0
                revenue_data.append({
                    "month": month_start.strftime("%b"),
                    "collected": float(collected),
                    "pending": float(pending),
                })

        # Performance data — filtered by the full term string (e.g. "Term 2, 2025/2026")
        # ExamMark.term stores the full string as saved by the marks entry page
        subjects = Subject.objects.filter(status="active")[:10]
        performance_data = []
        for subject in subjects:
            if teacher_class_ids is not None:
                # Teachers: only marks for students in their assigned classes
                avg_score = ExamMark.objects.filter(
                    subject=subject,
                    term=term_param,
                    student_class_id__in=teacher_class_ids
                ).aggregate(avg=Avg("score"))["avg"]
            else:
                # Admins/accountants: all marks
                avg_score = ExamMark.objects.filter(
                    subject=subject,
                    term=term_param,
                ).aggregate(avg=Avg("score"))["avg"]
            if avg_score is not None:
                performance_data.append({
                    "subject": subject.name,
                    "average": round(float(avg_score), 1),
                })

        # Attendance data — real data from Attendance model, last 30 days grouped by weekday
        thirty_ago = today - datetime.timedelta(days=30)
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri"]
        agg = {d: {"present": 0, "absent": 0} for d in day_names}
        if teacher_class_ids is not None:
            # Teachers: only attendance for their assigned classes
            attendance_qs = Attendance.objects.filter(
                date__gte=thirty_ago,
                date__lte=today,
                student_class_id__in=teacher_class_ids
            )
        else:
            # Admins/accountants: all attendance
            attendance_qs = Attendance.objects.filter(date__gte=thirty_ago, date__lte=today)
        
        for rec in attendance_qs:
            wd = rec.date.weekday()  # 0=Mon … 4=Fri
            if 0 <= wd <= 4:
                key = day_names[wd]
                agg[key]["present"] += rec.present
                agg[key]["absent"] += rec.absent
        attendance_data = [
            {"day": d, "present": agg[d]["present"], "absent": agg[d]["absent"]}
            for d in day_names
        ]

        return Response({
            "enrollmentData": enrollment_data,
            "revenueData": revenue_data,
            "performanceData": performance_data,
            "attendanceData": attendance_data,
        })


#  Team viewsets 

class TeamMemberViewSet(viewsets.ModelViewSet):
    """
    Public GET (list/retrieve)  no auth required.
    POST/PUT/PATCH/DELETE  super_admin or admin only.
    """
    queryset = TeamMember.objects.all().order_by("order", "first_name")
    serializer_class = TeamMemberSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["first_name", "last_name", "title", "department"]
    ordering_fields = ["order", "first_name", "created_at"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsSuperAdminOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        # Public endpoint: only active members
        if not (self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(is_active=True)
        dept = self.request.query_params.get("department")
        if dept:
            qs = qs.filter(department=dept)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


class CEOMessageViewSet(viewsets.ModelViewSet):
    """
    Public GET  no auth required.
    POST/PUT/PATCH/DELETE  super_admin or admin only.
    """
    queryset = CEOMessage.objects.all()
    serializer_class = CEOMessageSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "active"):
            return [AllowAny()]
        return [IsSuperAdminOrAdmin()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    @action(detail=False, methods=["get"], url_path="active")
    def active(self, request):
        msg = CEOMessage.objects.filter(is_active=True).first()
        if msg:
            return Response(CEOMessageSerializer(msg, context={"request": request}).data)
        return Response(None)


class FundraiserViewSet(viewsets.ModelViewSet):
    """
    Public GET (list/retrieve) — no auth required.
    POST/PUT/PATCH/DELETE — super_admin or admin only.
    """
    queryset = Fundraiser.objects.all().order_by("order", "-created_at")
    serializer_class = FundraiserSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["title", "category", "description"]
    ordering_fields = ["order", "created_at", "goal_amount", "raised_amount"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsSuperAdminOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        # Public visitors only see active fundraisers
        if not (self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(status="active")
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        featured = self.request.query_params.get("featured")
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


class DonationViewSet(viewsets.ModelViewSet):
    """
    POST: anyone can submit a donation record / message of support.
    GET list / retrieve / update / destroy: super_admin or admin only.
    """
    queryset = Donation.objects.select_related("fundraiser").all()
    serializer_class = DonationSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["donor_name", "message", "fundraiser__title"]
    ordering_fields = ["created_at", "amount"]

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [IsSuperAdminOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        fundraiser_id = self.request.query_params.get("fundraiser")
        if fundraiser_id:
            qs = qs.filter(fundraiser_id=fundraiser_id)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs
