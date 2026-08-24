from rest_framework import serializers

from core.utils import get_teacher_for, get_user_role
from .models import Subject, Teacher, Class, TeacherAssignment, Timetable, Attendance, LessonPlan, AcademicCalendar, StudentAttendance, TeacherAttendance


class SubjectSerializer(serializers.ModelSerializer):
    teacher_names = serializers.SerializerMethodField()
    class_count = serializers.SerializerMethodField()

    class Meta:
        model = Subject
        fields = "__all__"
        read_only_fields = ["id"]

    def get_teacher_names(self, obj):
        return list(obj.teachers.values_list("name", flat=True))

    def get_class_count(self, obj):
        return obj.classes.filter(status="active").count()


class TeacherListSerializer(serializers.ModelSerializer):
    subject_names = serializers.SerializerMethodField()
    assigned_class_names = serializers.SerializerMethodField()
    class_teacher_of = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            "id", "name", "email", "phone", "gender", "qualification",
            "join_date", "department", "years_of_experience", "salary",
            "status", "subjects", "subject_names", "assigned_class_names", "class_teacher_of",
        ]

    def get_subject_names(self, obj):
        return list(obj.subjects.values_list("name", flat=True))

    def get_assigned_class_names(self, obj):
        return list(
            obj.assignments.filter(status="active")
            .values_list("student_class__name", flat=True)
            .distinct()
        )

    def get_class_teacher_of(self, obj):
        cls = obj.class_teacher_of.first()
        return cls.name if cls else None


class TeacherDetailSerializer(TeacherListSerializer):
    class Meta(TeacherListSerializer.Meta):
        fields = "__all__"
        read_only_fields = ["id"]


class ClassListSerializer(serializers.ModelSerializer):
    class_teacher_name = serializers.SerializerMethodField()
    subject_names = serializers.SerializerMethodField()
    student_count = serializers.ReadOnlyField()
    enrolled_count = serializers.SerializerMethodField()
    can_manage_attendance = serializers.SerializerMethodField()

    class Meta:
        model = Class
        fields = [
            "id", "name", "section", "level", "arm", "capacity",
            "room", "status", "class_teacher", "class_teacher_name",
            "subject_names", "student_count", "enrolled_count",
            "can_manage_attendance",
        ]

    def get_class_teacher_name(self, obj):
        return obj.class_teacher.name if obj.class_teacher else None

    def get_subject_names(self, obj):
        return list(obj.subjects.values_list("name", flat=True))

    def get_enrolled_count(self, obj):
        # student_count only counts active students. Marks Entry needs the total
        # too: a class whose only student is suspended looks identical to an empty
        # class otherwise, and the screen then shows a blank grid with no reason.
        return obj.students.count()

    def _signed_in_teacher_id(self):
        """The Teacher row behind the request, resolved once for the whole list."""
        if not hasattr(self, "_teacher_id"):
            request = self.context.get("request")
            teacher = get_teacher_for(request.user) if request else None
            self._teacher_id = teacher.id if teacher else None
        return self._teacher_id

    def get_can_manage_attendance(self, obj):
        """May the signed-in user edit this class's register, or only read it?

        The attendance screen cannot work this out for itself: teachers are not
        allowed to read /api/teachers/, so they have no way to compare their own
        id against ``class_teacher``. Without this flag the page would have to
        offer everyone an editable register and let the save fail.
        """
        request = self.context.get("request")
        if request is None:
            return False
        role = get_user_role(request.user)
        if role in ("super_admin", "admin"):
            return True
        if role != "teacher":
            return False
        return obj.class_teacher_id is not None and obj.class_teacher_id == self._signed_in_teacher_id()


class ClassDetailSerializer(ClassListSerializer):
    class Meta(ClassListSerializer.Meta):
        fields = "__all__"
        read_only_fields = ["id"]


class TeacherAssignmentSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    class_name = serializers.CharField(source="student_class.name", read_only=True)
    department = serializers.CharField(source="subject.department", read_only=True)

    class Meta:
        model = TeacherAssignment
        fields = "__all__"
        read_only_fields = ["id"]


class TimetableSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="student_class.name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    teacher_name = serializers.CharField(source="teacher.name", read_only=True)

    class Meta:
        model = Timetable
        fields = "__all__"
        read_only_fields = ["id"]

    def validate(self, data):
        teacher = data.get("teacher")
        day = data.get("day")
        period = data.get("period")
        instance = self.instance  # None on create, existing object on update

        if teacher and day and period is not None:
            qs = Timetable.objects.filter(teacher=teacher, day=day, period=period)
            if instance:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                conflict = qs.select_related("student_class").first()
                raise serializers.ValidationError(
                    f"{teacher.name} is already teaching {conflict.student_class.name} "
                    f"at {day} Period {period}. Please choose a different slot."
                )
        return data


class AttendanceSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="student_class.name", read_only=True)
    total_students = serializers.ReadOnlyField()
    attendance_rate = serializers.ReadOnlyField()

    class Meta:
        model = Attendance
        fields = "__all__"
        read_only_fields = ["id", "total_students", "attendance_rate"]


class LessonPlanSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    class_name = serializers.CharField(source="student_class.name", read_only=True)
    teacher_name = serializers.CharField(source="teacher.name", read_only=True)

    class Meta:
        model = LessonPlan
        fields = "__all__"
        read_only_fields = ["id"]


class AcademicCalendarSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicCalendar
        fields = "__all__"
        read_only_fields = ["id"]


class StudentAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_reg_no = serializers.CharField(source="student.reg_no", read_only=True)
    class_name = serializers.CharField(source="student_class.name", read_only=True)

    class Meta:
        model = StudentAttendance
        fields = "__all__"
        read_only_fields = ["id"]

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"


class TeacherAttendanceSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.name", read_only=True)
    teacher_department = serializers.CharField(source="teacher.department", read_only=True)

    class Meta:
        model = TeacherAttendance
        fields = "__all__"
        read_only_fields = ["id"]
