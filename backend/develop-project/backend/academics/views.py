from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsSuperAdminOrAdmin, IsTeacherOrAdmin
from core.utils import (
    get_teacher_class_ids, get_teacher_for, get_teacher_homeroom_class_ids, get_user_role,
)
from .models import Subject, Teacher, Class, TeacherAssignment, Timetable, Attendance, LessonPlan, AcademicCalendar, StudentAttendance, TeacherAttendance
from .serializers import (
    SubjectSerializer,
    TeacherListSerializer,
    TeacherDetailSerializer,
    ClassListSerializer,
    ClassDetailSerializer,
    TeacherAssignmentSerializer,
    TimetableSerializer,
    AttendanceSerializer,
    LessonPlanSerializer,
    AcademicCalendarSerializer,
    StudentAttendanceSerializer,
    TeacherAttendanceSerializer,
)


class SubjectViewSet(viewsets.ModelViewSet):
    """
    Subject management - Teachers can view, only Admins can modify.
    """
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsTeacherOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["department", "type", "status"]
    search_fields = ["name", "code", "department"]

    def get_permissions(self):
        """Only admins can create/update/delete subjects."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdminOrAdmin()]
        return [IsTeacherOrAdmin()]


class TeacherViewSet(viewsets.ModelViewSet):
    """
    Teacher management - Only Admins can create/modify, others can view.
    """
    queryset = Teacher.objects.prefetch_related("subjects", "assignments").all()
    permission_classes = [IsSuperAdminOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["department", "status", "gender"]
    search_fields = ["name", "email", "subjects__name"]

    def get_serializer_class(self):
        if self.action == "list":
            return TeacherListSerializer
        return TeacherDetailSerializer


class ClassViewSet(viewsets.ModelViewSet):
    """
    Class management - Only Admins can create/modify, teachers can view.
    """
    queryset = Class.objects.select_related("class_teacher").prefetch_related("subjects").all()
    permission_classes = [IsTeacherOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["section", "status"]
    search_fields = ["name", "class_teacher__name", "room"]

    def get_queryset(self):
        """Teachers see only their assigned classes."""
        user = self.request.user
        role = get_user_role(user)

        if role in ['super_admin', 'admin']:
            return Class.objects.select_related("class_teacher").prefetch_related("subjects").all()
        elif role == 'teacher':
            all_ids = get_teacher_class_ids(get_teacher_for(user))
            return Class.objects.filter(id__in=all_ids).select_related("class_teacher").prefetch_related("subjects")
        return Class.objects.none()

    def get_permissions(self):
        """Only admins can create/update/delete classes."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdminOrAdmin()]
        return [IsTeacherOrAdmin()]

    def get_serializer_class(self):
        if self.action == "list":
            return ClassListSerializer
        return ClassDetailSerializer


class TeacherAssignmentViewSet(viewsets.ModelViewSet):
    """
    Teacher assignments - Only Admins can manage.
    """
    queryset = TeacherAssignment.objects.select_related("teacher", "subject", "student_class").all()
    serializer_class = TeacherAssignmentSerializer
    permission_classes = [IsSuperAdminOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["status", "subject__department"]
    search_fields = ["teacher__name", "subject__name", "student_class__name"]


class TimetableViewSet(viewsets.ModelViewSet):
    """
    Timetable - Teachers can view their timetables, Admins can modify.
    """
    queryset = Timetable.objects.select_related("student_class", "subject", "teacher").all()
    serializer_class = TimetableSerializer
    permission_classes = [IsTeacherOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["student_class", "day"]

    def get_queryset(self):
        """Teachers see only their own timetables."""
        user = self.request.user
        role = get_user_role(user)

        if role in ['super_admin', 'admin']:
            return Timetable.objects.select_related("student_class", "subject", "teacher").all()
        elif role == 'teacher':
            teacher = get_teacher_for(user)
            if teacher is None:
                return Timetable.objects.none()
            return Timetable.objects.filter(teacher=teacher).select_related("student_class", "subject", "teacher")
        return Timetable.objects.none()

    def get_permissions(self):
        """Only admins can create/update/delete timetables."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdminOrAdmin()]
        return [IsTeacherOrAdmin()]


class ClassTeacherWritesMixin:
    """Anyone who can see a register may read it; only its class teacher edits it.

    A subject teacher shares a class with its class teacher but not the
    responsibility for its attendance, so they keep the view and lose every
    write. Admins are untouched — ``_require_class_teacher`` only bites for the
    ``teacher`` role.

    Reads stay scoped by ``get_queryset``; this covers the write paths, which
    that queryset does not reach on create.
    """

    NOT_CLASS_TEACHER = (
        "Only the class teacher can change attendance for this class. "
        "As a subject teacher you can view it but not edit it."
    )

    def _require_class_teacher(self, *classes):
        if get_user_role(self.request.user) != "teacher":
            return
        allowed = get_teacher_homeroom_class_ids(get_teacher_for(self.request.user))
        for student_class in classes:
            if student_class is None or student_class.id not in allowed:
                raise PermissionDenied(self.NOT_CLASS_TEACHER)

    def perform_create(self, serializer):
        self._require_class_teacher(serializer.validated_data.get("student_class"))
        serializer.save()

    def perform_update(self, serializer):
        # Both ends of the move matter: the class the record sits in now, and the
        # one a PATCH would carry it into. Checking only the former would let a
        # class teacher push a row into a colleague's class.
        current = serializer.instance.student_class
        self._require_class_teacher(
            current, serializer.validated_data.get("student_class", current)
        )
        serializer.save()

    def perform_destroy(self, instance):
        self._require_class_teacher(instance.student_class)
        instance.delete()


class AttendanceViewSet(ClassTeacherWritesMixin, viewsets.ModelViewSet):
    """
    Attendance - the class teacher records it; subject teachers can only look.
    """
    queryset = Attendance.objects.select_related("student_class").all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsTeacherOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["student_class", "date"]

    def get_queryset(self):
        """Teachers see only their class attendance."""
        user = self.request.user
        role = get_user_role(user)

        if role in ['super_admin', 'admin']:
            return Attendance.objects.select_related("student_class").all()
        elif role == 'teacher':
            all_ids = get_teacher_class_ids(get_teacher_for(user))
            return Attendance.objects.filter(student_class_id__in=all_ids).select_related("student_class")
        return Attendance.objects.none()


class LessonPlanViewSet(viewsets.ModelViewSet):
    """
    Lesson plans - Teachers manage their own lesson plans.
    """
    queryset = LessonPlan.objects.select_related("subject", "student_class", "teacher").all()
    serializer_class = LessonPlanSerializer
    permission_classes = [IsTeacherOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["subject", "student_class", "status", "teacher"]
    search_fields = ["topic", "subject__name", "teacher__name"]

    def get_queryset(self):
        """Teachers see only their own lesson plans."""
        user = self.request.user
        role = get_user_role(user)

        if role in ['super_admin', 'admin']:
            return LessonPlan.objects.select_related("subject", "student_class", "teacher").all()
        elif role == 'teacher':
            teacher = get_teacher_for(user)
            if teacher is None:
                return LessonPlan.objects.none()
            return LessonPlan.objects.filter(teacher=teacher).select_related("subject", "student_class", "teacher")
        return LessonPlan.objects.none()

    def _pin_to_signed_in_teacher(self, serializer):
        """A teacher's plan is always filed under them, whatever the form sent.

        The teacher picker on the page is populated from /api/teachers/, which
        teachers are not allowed to read — so their plans were saved with no
        teacher at all and then filtered straight back out of their own list.
        Admins keep the ability to file a plan for anyone.
        """
        if get_user_role(self.request.user) != 'teacher':
            serializer.save()
            return
        teacher = get_teacher_for(self.request.user)
        if teacher is None:
            raise PermissionDenied("No teacher record is linked to your account.")
        serializer.save(teacher=teacher)

    def perform_create(self, serializer):
        self._pin_to_signed_in_teacher(serializer)

    def perform_update(self, serializer):
        self._pin_to_signed_in_teacher(serializer)


class AcademicCalendarViewSet(viewsets.ModelViewSet):
    """
    Academic calendar - All can view, only Admins can modify.
    """
    queryset = AcademicCalendar.objects.all()
    serializer_class = AcademicCalendarSerializer
    permission_classes = [IsTeacherOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["type"]

    def get_permissions(self):
        """Only admins can create/update/delete calendar events."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdminOrAdmin()]
        return [IsTeacherOrAdmin()]


class StudentAttendanceViewSet(ClassTeacherWritesMixin, viewsets.ModelViewSet):
    """
    Per-student daily attendance. Filter by date and/or class.

    A teacher sees every class they are involved in, but only records and
    corrects attendance for the classes they are class teacher of.
    """
    serializer_class = StudentAttendanceSerializer
    permission_classes = [IsTeacherOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["date", "student_class", "status", "student"]
    search_fields = ["student__first_name", "student__last_name", "student__reg_no"]

    def get_queryset(self):
        user = self.request.user
        role = get_user_role(user)
        if role in ["super_admin", "admin"]:
            return StudentAttendance.objects.select_related("student", "student_class").all()
        elif role == "teacher":
            all_ids = get_teacher_class_ids(get_teacher_for(user))
            return StudentAttendance.objects.filter(
                student_class_id__in=all_ids
            ).select_related("student", "student_class")
        return StudentAttendance.objects.none()

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Per-class present/absent/late counts for one date.

        GET /api/student-attendance/summary/?date=YYYY-MM-DD

        The dashboard used to fetch every record for the day and tally them in
        the browser, which silently stopped at one page — so the summary table
        under-reported as soon as a school had more than a page of pupils.
        Counting in the database has no such ceiling.
        """
        date = request.query_params.get("date")
        qs = self.get_queryset()
        if date:
            qs = qs.filter(date=date)
        rows = (
            qs.values("student_class_id", "student_class__name")
            .annotate(
                present=Count("id", filter=Q(status="present")),
                absent=Count("id", filter=Q(status="absent")),
                late=Count("id", filter=Q(status="late")),
            )
            .order_by("student_class__name")
        )
        return Response([
            {
                "student_class": r["student_class_id"],
                "class_name": r["student_class__name"] or "",
                "present": r["present"],
                "absent": r["absent"],
                "late": r["late"],
            }
            for r in rows
        ])


class TeacherAttendanceViewSet(viewsets.ModelViewSet):
    """
    Per-teacher daily attendance. Filter by date and/or status.
    """
    queryset = TeacherAttendance.objects.select_related("teacher").all()
    serializer_class = TeacherAttendanceSerializer
    permission_classes = [IsSuperAdminOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["date", "teacher", "status"]
    search_fields = ["teacher__name", "teacher__department"]
