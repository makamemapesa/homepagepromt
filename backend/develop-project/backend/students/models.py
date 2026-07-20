from django.db import models
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
import os

# File upload validators
def validate_file_size(value):
    """Limit file size to 5MB"""
    filesize = value.size
    if filesize > 5 * 1024 * 1024:  # 5MB
        raise ValidationError("File size cannot exceed 5MB")

def validate_file_name(value):
    """Prevent path traversal attacks"""
    filename = os.path.basename(value.name)
    if filename != value.name or ".." in value.name or "/" in value.name:
        raise ValidationError("Invalid file name")
from donors.models import Donor


class Student(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("suspended", "Suspended"),
        ("graduated", "Graduated"),
        ("withdrawn", "Withdrawn"),
    ]
    FEE_STATUS_CHOICES = [
        ("paid", "Paid"),
        ("partial", "Partial"),
        ("unpaid", "Unpaid"),
    ]
    GENDER_CHOICES = [("Male", "Male"), ("Female", "Female")]
    STUDENT_TYPE_CHOICES = [("Day", "Day"), ("Boarding", "Boarding")]

    # Identifiers
    reg_no = models.CharField(max_length=50, unique=True)

    # Personal
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    blood_group = models.CharField(max_length=5, blank=True)
    religion = models.CharField(max_length=50, blank=True)
    state_of_origin = models.CharField(max_length=100, blank=True)
    nationality = models.CharField(max_length=100, default="Tanzanian")
    residential_address = models.TextField(blank=True)
    is_orphan = models.BooleanField(default=False)

    # Academic placement
    student_class = models.ForeignKey(
        "academics.Class",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    student_type = models.CharField(max_length=10, choices=STUDENT_TYPE_CHOICES, default="Day")
    admission_date = models.DateField()
    academic_session = models.CharField(max_length=20, default="2026")
    previous_school = models.CharField(max_length=200, blank=True)
    previous_class = models.CharField(max_length=50, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active", db_index=True)
    fee_status = models.CharField(max_length=20, choices=FEE_STATUS_CHOICES, default="unpaid", db_index=True)

    # Donor
    donor = models.ForeignKey(
        Donor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sponsored_students",
    )
    donor_number = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.reg_no})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def class_name(self):
        return self.student_class.name if self.student_class else ""


class ParentGuardian(models.Model):
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name="parent")
    user = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="guardian_records",
        help_text="Linked login account (parent portal access)",
    )
    full_name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=50)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    occupation = models.CharField(max_length=100, blank=True)
    office_address = models.TextField(blank=True)
    home_address = models.TextField(blank=True)
    emergency_contact_name = models.CharField(max_length=200, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f"{self.full_name} (parent of {self.student})"


class EmergencyContact(models.Model):
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="emergency_contacts"
    )
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    relationship = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} ({self.relationship}) — emergency contact for {self.student}"


class StudentDocument(models.Model):
    DOCUMENT_TYPES = [
        ("passport_photo", "Passport Photo"),
        ("birth_certificate", "Birth Certificate"),
        ("previous_report", "Previous School Report"),
        ("transfer_certificate", "Transfer Certificate"),
        ("medical_certificate", "Medical Certificate"),
        ("other", "Other"),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES)
    file = models.FileField(
        upload_to="student_documents/",
        validators=[
            FileExtensionValidator(allowed_extensions=['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']),
            validate_file_size,
            validate_file_name,
        ],
        help_text="Allowed: PDF, JPG, PNG, DOC, DOCX. Max size: 5MB"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.document_type} for {self.student}"


class AcademicHistory(models.Model):
    MOVEMENT_CHOICES = [
        ("promotion", "Promotion"),
        ("stream_change", "Stream Change"),
        ("repetition", "Repetition"),
        ("demotion", "Demotion"),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="academic_history")
    term = models.CharField(max_length=50)
    academic_session = models.CharField(max_length=20)
    position = models.IntegerField(default=0)
    average = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    grade = models.CharField(max_length=5, blank=True)
    division = models.CharField(max_length=5, blank=True)
    previous_class = models.CharField(max_length=100, blank=True)
    new_class = models.CharField(max_length=100, blank=True)
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_CHOICES, default="promotion")
    reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-academic_session", "term"]
        unique_together = ["student", "term", "academic_session"]

    def __str__(self):
        return f"{self.student} - {self.term} {self.academic_session}"
