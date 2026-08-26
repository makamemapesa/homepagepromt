from decimal import Decimal

from rest_framework import serializers
from .models import ExamMark, ExamResult, SubjectResult


class ExamMarkSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    reg_no = serializers.CharField(source="student.reg_no", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    class_name = serializers.CharField(source="student_class.name", read_only=True)
    grade = serializers.ReadOnlyField()
    # Every assessment in the portal is marked out of 100. Without these bounds a
    # typo like 950 is stored happily and silently wrecks the class average.
    score = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0"), max_value=Decimal("100")
    )

    class Meta:
        model = ExamMark
        fields = "__all__"
        read_only_fields = ["id", "grade"]

    def validate_term(self, value):
        return value.strip()

    def validate_exam_type(self, value):
        # " CA 1 " and "CA 1" are the same assessment to a human, but a distinct
        # unique_together key to the database — which would then show up twice in
        # the exam-type picker and be scored twice.
        return value.strip()

    def validate_academic_session(self, value):
        return value.strip()


class SubjectResultSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = SubjectResult
        fields = "__all__"
        read_only_fields = ["id"]


class ExamResultSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    reg_no = serializers.CharField(source="student.reg_no", read_only=True)
    class_name = serializers.CharField(source="student_class.name", read_only=True)
    subject_results = SubjectResultSerializer(many=True, read_only=True)

    class Meta:
        model = ExamResult
        fields = "__all__"
        read_only_fields = [
            "id", "total", "average", "position", "grade", "division",
            # Set only by ExamResultViewSet.send_to_parents, which is where the
            # fee check lives. Writable here, a PATCH could publish a report card
            # to a family that has not paid — or forge the waiver that says an
            # administrator allowed it.
            "released_at", "released_by", "fee_override", "fee_override_reason",
        ]
