from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsSuperAdminOrAdmin, IsTeacherOrAdmin
from core.utils import get_user_role
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
            try:
                teacher = Teacher.objects.get(email=user.email)
                homeroom_ids = set(Class.objects.filter(class_teacher=teacher).values_list('id', flat=True))
                assigned_ids = set(TeacherAssignment.objects.filter(teacher=teacher, status='active').values_list('student_class_id', flat=True))
                all_ids = homeroom_ids | assigned_ids
                return Class.objects.filter(id__in=all_ids).select_related("class_teacher").prefetch_related("subjects")
            except Teacher.DoesNotExist:
                return Class.objects.none()
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
            try:
                teacher = Teacher.objects.get(email=user.email)
                return Timetable.objects.filter(teacher=teacher).select_related("student_class", "subject", "teacher")
            except Teacher.DoesNotExist:
                return Timetable.objects.none()
        return Timetable.objects.none()

    def get_permissions(self):
        """Only admins can create/update/delete timetables."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdminOrAdmin()]
        return [IsTeacherOrAdmin()]


class AttendanceViewSet(viewsets.ModelViewSet):
    """
    Attendance - Teachers can manage their class attendance.
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
            try:
                teacher = Teacher.objects.get(email=user.email)
                homeroom_ids = set(Class.objects.filter(class_teacher=teacher).values_list('id', flat=True))
                assigned_ids = set(TeacherAssignment.objects.filter(teacher=teacher, status='active').values_list('student_class_id', flat=True))
                all_ids = homeroom_ids | assigned_ids
                return Attendance.objects.filter(student_class_id__in=all_ids).select_related("student_class")
            except Teacher.DoesNotExist:
                return Attendance.objects.none()
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
            try:
                teacher = Teacher.objects.get(email=user.email)
                return LessonPlan.objects.filter(teacher=teacher).select_related("subject", "student_class", "teacher")
            except Teacher.DoesNotExist:
                return LessonPlan.objects.none()
        return LessonPlan.objects.none()


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


class StudentAttendanceViewSet(viewsets.ModelViewSet):
    """
    Per-student daily attendance. Filter by date and/or class.
    Teachers can only access attendance for their own classes.
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
            try:
                teacher = Teacher.objects.get(email=user.email)
                homeroom_ids = set(Class.objects.filter(class_teacher=teacher).values_list('id', flat=True))
                assigned_ids = set(TeacherAssignment.objects.filter(teacher=teacher, status='active').values_list('student_class_id', flat=True))
                all_ids = homeroom_ids | assigned_ids
                return StudentAttendance.objects.filter(
                    student_class_id__in=all_ids
                ).select_related("student", "student_class")
            except Teacher.DoesNotExist:
                return StudentAttendance.objects.none()
        return StudentAttendance.objects.none()


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
