from rest_framework import serializers
from .models import FeeStructure, Payment


class FeeStructureSerializer(serializers.ModelSerializer):
    total = serializers.ReadOnlyField()

    class Meta:
        model = FeeStructure
        fields = "__all__"
        read_only_fields = ["id", "total"]


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    reg_no = serializers.CharField(source="student.reg_no", read_only=True)
    class_name = serializers.CharField(source="student.class_name", read_only=True)

    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
