from rest_framework import serializers
from .models import Student, ParentGuardian, StudentDocument, AcademicHistory, EmergencyContact


class ParentGuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParentGuardian
        exclude = ["student"]
        read_only_fields = ["user"]


class StudentDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = StudentDocument
        exclude = ["student"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file:
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class AcademicHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicHistory
        exclude = ["student"]


class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        exclude = ["student"]
        read_only_fields = ["id"]


class StudentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    class_name = serializers.ReadOnlyField()
    full_name = serializers.ReadOnlyField()
    passport_photo_url = serializers.SerializerMethodField()
    last_movement_type = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id", "reg_no", "first_name", "last_name", "full_name",
            "student_class", "class_name", "gender", "status", "fee_status",
            "admission_date", "student_type", "is_orphan", "passport_photo_url",
            "last_movement_type",
        ]

    def get_last_movement_type(self, obj):
        h = obj.academic_history.first()
        return h.movement_type if h else None

    def get_passport_photo_url(self, obj):
        doc = obj.documents.filter(document_type="passport_photo").first()
        if doc and doc.file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(doc.file.url)
            return doc.file.url
        return None


class StudentDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested parent and documents."""
    parent = ParentGuardianSerializer(read_only=True)
    documents = StudentDocumentSerializer(many=True, read_only=True)
    academic_history = AcademicHistorySerializer(many=True, read_only=True)
    emergency_contacts = EmergencyContactSerializer(many=True, read_only=True)
    class_name = serializers.ReadOnlyField()
    full_name = serializers.ReadOnlyField()
    donor_name = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "status", "fee_status"]

    def get_donor_name(self, obj):
        return obj.donor.name if obj.donor else None


class StudentCreateSerializer(serializers.ModelSerializer):
    """Used for registration wizard — accepts parent data nested."""
    parent = ParentGuardianSerializer(required=False)
    parent_user_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    emergency_contacts = EmergencyContactSerializer(many=True, required=False)
    full_name = serializers.ReadOnlyField()
    class_name = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated_data):
        parent_data = validated_data.pop("parent", None)
        parent_user_id = validated_data.pop("parent_user_id", None)
        emergency_contacts_data = validated_data.pop("emergency_contacts", [])
        student = Student.objects.create(**validated_data)
        if parent_data:
            if parent_user_id:
                from django.contrib.auth.models import User as AuthUser
                try:
                    parent_user = AuthUser.objects.get(pk=parent_user_id)
                    pg = ParentGuardian.objects.create(student=student, user=parent_user, **parent_data)
                    # Back-fill: collect all known phones for this parent user
                    # (the new guardian's phone + any phones from already-linked guardians)
                    phones = set()
                    if pg.phone:
                        phones.add(pg.phone)
                    for p in ParentGuardian.objects.filter(user=parent_user).exclude(pk=pg.pk).values_list("phone", flat=True):
                        if p:
                            phones.add(p)
                    if phones:
                        ParentGuardian.objects.filter(user__isnull=True, phone__in=phones).update(user=parent_user)
                except AuthUser.DoesNotExist:
                    ParentGuardian.objects.create(student=student, **parent_data)
            else:
                ParentGuardian.objects.create(student=student, **parent_data)
        for ec in emergency_contacts_data:
            EmergencyContact.objects.create(student=student, **ec)
        return student

    def update(self, instance, validated_data):
        parent_data = validated_data.pop("parent", None)
        parent_user_id = validated_data.pop("parent_user_id", None)
        emergency_contacts_data = validated_data.pop("emergency_contacts", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if parent_data:
            extra = {}
            if parent_user_id:
                from django.contrib.auth.models import User as AuthUser
                try:
                    extra["user"] = AuthUser.objects.get(pk=parent_user_id)
                except AuthUser.DoesNotExist:
                    pass
            pg, _ = ParentGuardian.objects.update_or_create(
                student=instance, defaults={**parent_data, **extra}
            )
            # Back-fill any other unlinked guardian records with same phone
            if extra.get("user") and pg.phone:
                ParentGuardian.objects.filter(user__isnull=True, phone=pg.phone).update(user=extra["user"])
        if emergency_contacts_data is not None:
            instance.emergency_contacts.all().delete()
            for ec in emergency_contacts_data:
                EmergencyContact.objects.create(student=instance, **ec)
        return instance
