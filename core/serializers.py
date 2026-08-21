from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, SchoolSettings, Notification, AuditLog, TeamMember, CEOMessage, Fundraiser, Donation, HomePageContent


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["role"]


class HomePageContentSerializer(serializers.ModelSerializer):
    """Every block on the public home page, in one payload.

    `fields = "__all__"` deliberately: new content blocks become editable and
    publicly readable the moment they are added to the model, instead of
    silently going missing because someone forgot to extend a field list.
    """
    logo = serializers.SerializerMethodField()
    hero_image_resolved = serializers.SerializerMethodField()

    class Meta:
        model = HomePageContent
        fields = "__all__"
        read_only_fields = ["id", "updated_at"]

    def _absolute(self, file_field):
        if not file_field:
            return ""
        request = self.context.get("request")
        return request.build_absolute_uri(file_field.url) if request else file_field.url

    def get_logo(self, obj):
        """Uploaded logo wins over a pasted URL; empty means use the bundled one."""
        return self._absolute(obj.logo_upload) or (obj.logo_url or "")

    def get_hero_image_resolved(self, obj):
        return self._absolute(obj.hero_image_upload) or (obj.hero_image or "")


class UserSerializer(serializers.ModelSerializer):
    # Use a method field to avoid RelatedObjectDoesNotExist when a User
    # has no associated UserProfile (e.g., superusers created with
    # `createsuperuser` which don't auto-create a profile).
    role = serializers.SerializerMethodField()
    parent_info = serializers.SerializerMethodField()
    last_login = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "role", "parent_info", "is_active", "last_login"]
        read_only_fields = ["last_login"]

    def get_parent_info(self, obj):
        guardian = obj.guardian_records.order_by("-id").first()
        if guardian:
            return {
                "full_name": guardian.full_name,
                "relationship": guardian.relationship,
                "phone": guardian.phone,
                "email": guardian.email,
                "occupation": guardian.occupation,
                "office_address": guardian.office_address,
                "home_address": guardian.home_address,
                "emergency_contact_name": guardian.emergency_contact_name,
                "emergency_contact_phone": guardian.emergency_contact_phone,
            }
        return None

    def get_role(self, obj):
        """Return the user's role.

        If a UserProfile exists, return its role. If a superuser has no
        profile yet, fall back to `super_admin` so the dashboard and role-based
        UI behave correctly.
        """
        profile = getattr(obj, "profile", None)
        if profile is not None and getattr(profile, "role", None):
            return profile.role
        if getattr(obj, "is_superuser", False):
            return "super_admin"
        if getattr(obj, "is_staff", False):
            return "admin"
        return ""


class UserCreateSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(
        choices=UserProfile.ROLE_CHOICES,
        write_only=True,
    )
    password = serializers.CharField(write_only=True, min_length=8)
    parent_guardian_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "password", "role", "parent_guardian_id"]

    def validate_email(self, value):
        # Allow creating/linking when a parent_guardian_id is provided and a
        # user with this email already exists (we will link instead of creating).
        exists = User.objects.filter(username=value).exists()
        if exists and not self.initial_data.get("parent_guardian_id"):
            raise serializers.ValidationError("Unable to create account. Please try again.")
        return value

    def validate_password(self, value):
        """Validate password meets Django's complexity requirements."""
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        role = validated_data.pop("role")
        password = validated_data.pop("password")
        email = validated_data.pop("email")
        parent_guardian_id = validated_data.pop("parent_guardian_id", None)
        # If a user with this email already exists (e.g. parent was created
        # earlier without a linked ParentGuardian), reuse that user instead
        # of attempting to create a duplicate.
        existing_user = User.objects.filter(username=email).first()
        if existing_user:
            user = existing_user
            if password:
                user.set_password(password)
                user.save()
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = role
            profile.save()
        else:
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                **validated_data,
            )
            # Use get_or_create to avoid IntegrityError when a post_save signal
            # or other process already created the profile for this user.
            profile, created = UserProfile.objects.get_or_create(user=user, defaults={"role": role})
            if not created:
                # Ensure role is set to the requested value when profile already exists.
                profile.role = role
                profile.save()
        if parent_guardian_id:
            from students.models import ParentGuardian
            pg = ParentGuardian.objects.filter(pk=parent_guardian_id, user__isnull=True).first()
            if pg:
                # Link ALL unlinked guardians with the same phone (same parent, multiple children)
                ParentGuardian.objects.filter(user__isnull=True, phone=pg.phone).update(user=user)
            else:
                ParentGuardian.objects.filter(pk=parent_guardian_id).update(user=user)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, required=False)
    password = serializers.CharField(write_only=True, required=False, min_length=8, allow_blank=True)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "is_active", "role", "password"]

    def validate_password(self, value):
        """Validate password meets Django's complexity requirements."""
        if value and value.strip():  # Only validate if password is provided
            from django.contrib.auth.password_validation import validate_password
            from django.core.exceptions import ValidationError as DjangoValidationError
            try:
                validate_password(value)
            except DjangoValidationError as e:
                raise serializers.ValidationError(list(e.messages))
        return value

    def update(self, instance, validated_data):
        role = validated_data.pop("role", None)
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password and password.strip():
            instance.set_password(password)
        instance.save()
        profile, _ = UserProfile.objects.get_or_create(user=instance)
        if role is not None:
            profile.role = role
        profile.save()
        return instance


class SchoolSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolSettings
        fields = "__all__"
        read_only_fields = ["id"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ["id", "created_at", "date"]


class AuditLogSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ["id", "timestamp", "user", "role", "action", "module", "detail", "ip", "status"]

    def get_user(self, obj):
        return obj.user.get_full_name() if obj.user else "System"

    def get_role(self, obj):
        try:
            return obj.user.profile.role if obj.user else ""
        except Exception:
            return ""


# ── Team serializers ──────────────────────────────────────────────────────────

class TeamMemberSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = TeamMember
        fields = [
            "id", "first_name", "last_name", "title", "department",
            "bio", "email", "phone", "linkedin_url",
            "photo", "photo_url", "is_active", "order", "slug",
            "created_at", "updated_at",
        ]
        read_only_fields = ["slug", "created_at", "updated_at"]

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None


class CEOMessageSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = CEOMessage
        fields = [
            "id", "heading", "body", "author_name", "author_title",
            "photo", "photo_url", "is_active", "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None


class FundraiserSerializer(serializers.ModelSerializer):
    image_url        = serializers.SerializerMethodField()
    progress_percent = serializers.ReadOnlyField()

    class Meta:
        model = Fundraiser
        fields = [
            "id", "title", "slug", "category", "description", "short_desc",
            "goal_amount", "raised_amount", "donor_count",
            "image", "image_url", "status", "is_featured",
            "start_date", "end_date", "donate_url",
            "progress_percent", "order", "created_at", "updated_at",
        ]
        read_only_fields = ["slug", "progress_percent", "created_at", "updated_at"]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class DonationSerializer(serializers.ModelSerializer):
    # Read: show display name (hide if anonymous)
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Donation
        fields = [
            "id", "fundraiser", "donor_name", "donor_email",
            "amount", "message", "is_anonymous", "display_name",
            "status", "created_at",
        ]
        # donor_email visible to admin (GET endpoint is admin-only)
        extra_kwargs = {
            "donor_name": {"write_only": False},
        }
        read_only_fields = ["id", "created_at", "display_name"]

    def get_display_name(self, obj):
        return "Anonymous" if obj.is_anonymous else obj.donor_name
