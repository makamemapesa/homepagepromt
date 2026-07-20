from rest_framework import serializers
from django.contrib.auth.models import User
from .models import AdmissionWindow, Applicant, ApplicationPayment, Interview


class AdmissionWindowSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionWindow
        fields = "__all__"


class ApplicationPaymentSerializer(serializers.ModelSerializer):
    confirmed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationPayment
        fields = "__all__"

    def get_confirmed_by_name(self, obj):
        if obj.confirmed_by:
            return obj.confirmed_by.get_full_name() or obj.confirmed_by.username
        return None


class InterviewSerializer(serializers.ModelSerializer):
    interviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = Interview
        fields = "__all__"

    def get_interviewer_name(self, obj):
        if obj.interviewer:
            return obj.interviewer.get_full_name() or obj.interviewer.username
        return None


class ApplicantListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    payment = ApplicationPaymentSerializer(read_only=True)
    interview = InterviewSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Applicant
        fields = [
            "id", "full_name", "first_name", "last_name", "gender",
            "applying_for_class", "student_type", "academic_session",
            "parent_name", "parent_phone", "parent_email",
            "status", "application_date", "payment", "interview",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class ApplicantDetailSerializer(serializers.ModelSerializer):
    payment = ApplicationPaymentSerializer(read_only=True)
    interview = InterviewSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Applicant
        fields = "__all__"

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class PublicApplicantCreateSerializer(serializers.ModelSerializer):
    """Used by the parent-facing apply form. No auth required."""
    class Meta:
        model = Applicant
        fields = [
            "window",
            "first_name", "last_name", "middle_name",
            "date_of_birth", "gender", "religion", "nationality",
            "previous_school", "applying_for_class", "student_type",
            "academic_session",
            "parent_name", "parent_phone", "parent_email",
            "parent_address", "relationship",
        ]
