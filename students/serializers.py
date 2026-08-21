from rest_framework import serializers
from .models import Student, ParentGuardian, StudentDocument, AcademicHistory, EmergencyContact


class ParentGuardianSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    has_portal_access = serializers.SerializerMethodField()

    class Meta:
        model = ParentGuardian
        exclude = ["student"]
        read_only_fields = ["user", "has_portal_access"]

    def get_has_portal_access(self, obj):
        return obj.user_id is not None


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
            "admission_date", "student_type", "is_orphan", "has_disability",
            "passport_photo_url", "last_movement_type",
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
    """Full serializer with nested guardians and documents."""
    # Every guardian — mother, father, uncle, elder brother — each of whom can
    # hold their own portal login. `parent` stays as the main contact so the
    # older single-guardian screens keep working.
    guardians = ParentGuardianSerializer(many=True, read_only=True)
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
    """Used for the registration wizard — accepts guardian data nested.

    `parent` is the main contact; `guardians` carries any others (a father,
    uncle or elder brother alongside the mother). Each guardian can later be
    given their own portal login from User Management.
    """
    parent = ParentGuardianSerializer(required=False)
    guardians = ParentGuardianSerializer(many=True, required=False)
    parent_user_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    emergency_contacts = EmergencyContactSerializer(many=True, required=False)
    full_name = serializers.ReadOnlyField()
    class_name = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        """A student flagged as having a disability must have the details recorded."""
        has_disability = attrs.get(
            "has_disability", getattr(self.instance, "has_disability", False)
        )
        details = attrs.get(
            "disability_details", getattr(self.instance, "disability_details", "")
        )
        if has_disability and not (details or "").strip():
            raise serializers.ValidationError({
                "disability_details": "Please describe the disability and any support the student needs."
            })
        return attrs

    # ── Guardians ────────────────────────────────────────────────────────

    @staticmethod
    def _resolve_user(user_id):
        from django.contrib.auth.models import User as AuthUser

        if not user_id:
            return None
        return AuthUser.objects.filter(pk=user_id).first()

    @staticmethod
    def _link_same_person(guardian, user):
        """Link other unlinked guardian records that share this phone number.

        One parent often has several children, each with their own guardian
        row; matching on the phone number saves re-linking each by hand.
        """
        if not user or not guardian.phone:
            return
        phones = {guardian.phone}
        phones.update(
            p for p in ParentGuardian.objects.filter(user=user)
            .exclude(pk=guardian.pk).values_list("phone", flat=True) if p
        )
        ParentGuardian.objects.filter(user__isnull=True, phone__in=phones).update(user=user)

    @staticmethod
    def _ordered_entries(parent_data, guardians_data):
        """Combine the main contact and the other guardians, primary first."""
        entries = []
        if parent_data:
            entry = dict(parent_data)
            entry.setdefault("is_primary", True)
            entries.append(entry)
        for guardian in guardians_data or []:
            entries.append(dict(guardian))

        # Exactly one main contact: the first flagged one wins, and if none is
        # flagged the first guardian becomes it.
        primary_taken = False
        for entry in entries:
            if entry.get("is_primary") and not primary_taken:
                primary_taken = True
            elif entry.get("is_primary"):
                entry["is_primary"] = False
        if entries and not primary_taken:
            entries[0]["is_primary"] = True
        return entries

    def create(self, validated_data):
        parent_data = validated_data.pop("parent", None)
        guardians_data = validated_data.pop("guardians", None)
        parent_user_id = validated_data.pop("parent_user_id", None)
        emergency_contacts_data = validated_data.pop("emergency_contacts", [])

        student = Student.objects.create(**validated_data)

        for index, entry in enumerate(self._ordered_entries(parent_data, guardians_data)):
            entry.pop("id", None)
            # The "link to an existing parent account" picker applies to the
            # main contact being registered alongside the student.
            user = self._resolve_user(parent_user_id) if index == 0 else None
            guardian = ParentGuardian.objects.create(student=student, user=user, **entry)
            self._link_same_person(guardian, user)

        for ec in emergency_contacts_data:
            EmergencyContact.objects.create(student=student, **ec)
        return student

    def update(self, instance, validated_data):
        parent_data = validated_data.pop("parent", None)
        guardians_data = validated_data.pop("guardians", None)
        parent_user_id = validated_data.pop("parent_user_id", None)
        emergency_contacts_data = validated_data.pop("emergency_contacts", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if guardians_data is not None or parent_data is not None:
            self._sync_guardians(instance, parent_data, guardians_data, parent_user_id)

        if emergency_contacts_data is not None:
            instance.emergency_contacts.all().delete()
            for ec in emergency_contacts_data:
                EmergencyContact.objects.create(student=instance, **ec)
        return instance

    def _sync_guardians(self, student, parent_data, guardians_data, parent_user_id):
        """Apply the submitted guardians to the student.

        Rows carrying an id are updated in place — which keeps their portal
        login attached — rows without one are added, and any existing guardian
        left out of the submission is removed.
        """
        existing = {g.pk: g for g in student.guardians.all()}
        entries = self._ordered_entries(parent_data, guardians_data)

        # A payload that only carries `parent` is editing the main contact and
        # must not disturb the other guardians.
        replace_all = guardians_data is not None

        kept = set()
        for index, entry in enumerate(entries):
            guardian_id = entry.pop("id", None)
            target = existing.get(guardian_id) if guardian_id else None
            if target is None and index == 0 and not guardian_id and not replace_all:
                # Legacy single-guardian payload: update the main contact.
                target = student.guardians.filter(is_primary=True).first() or student.guardians.first()

            user = self._resolve_user(parent_user_id) if index == 0 else None

            if target is not None:
                for field, value in entry.items():
                    setattr(target, field, value)
                if user is not None:
                    target.user = user
                target.save()
                guardian = target
            else:
                guardian = ParentGuardian.objects.create(student=student, user=user, **entry)

            kept.add(guardian.pk)
            self._link_same_person(guardian, user)

        if replace_all:
            student.guardians.exclude(pk__in=kept).delete()

        # Guarantee exactly one main contact survives.
        remaining = list(student.guardians.all())
        if remaining and not any(g.is_primary for g in remaining):
            first = remaining[0]
            first.is_primary = True
            first.save(update_fields=["is_primary"])
