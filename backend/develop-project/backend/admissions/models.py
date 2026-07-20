from django.db import models
from django.contrib.auth.models import User


class AdmissionWindow(models.Model):
    """Admin-controlled window during which online applications are accepted."""
    academic_session = models.CharField(max_length=20)
    open_date = models.DateField()
    close_date = models.DateField()
    is_active = models.BooleanField(default=True)
    application_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-open_date"]

    def __str__(self):
        return f"Applications {self.academic_session} ({self.open_date} – {self.close_date})"


class Applicant(models.Model):
    STATUS_CHOICES = [
        ("submitted", "Submitted"),
        ("payment_pending", "Payment Pending"),
        ("payment_confirmed", "Payment Confirmed"),
        ("interview_scheduled", "Interview Scheduled"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
        ("enrolled", "Enrolled"),  # converted to a Student record
    ]
    GENDER_CHOICES = [("Male", "Male"), ("Female", "Female")]
    STUDENT_TYPE_CHOICES = [("Day", "Day"), ("Boarding", "Boarding")]

    # Which window this belongs to
    window = models.ForeignKey(
        AdmissionWindow, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="applicants"
    )
    # Parent / guardian who applied (may have a portal account)
    parent_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="applications"
    )

    # --- Child's details ---
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    religion = models.CharField(max_length=50, blank=True)
    nationality = models.CharField(max_length=100, default="Tanzanian")
    previous_school = models.CharField(max_length=200, blank=True)
    applying_for_class = models.CharField(max_length=50)  # e.g. "Form 1", "Std 1"
    student_type = models.CharField(max_length=10, choices=STUDENT_TYPE_CHOICES, default="Day")
    academic_session = models.CharField(max_length=20)

    # --- Parent / guardian details ---
    parent_name = models.CharField(max_length=200)
    parent_phone = models.CharField(max_length=30)
    parent_email = models.EmailField(blank=True)
    parent_address = models.TextField(blank=True)
    relationship = models.CharField(max_length=50, default="Parent")

    # --- Pipeline status ---
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="submitted")
    application_date = models.DateField(auto_now_add=True)
    notes = models.TextField(blank=True)

    # When accepted → Student record created
    enrolled_student = models.OneToOneField(
        "students.Student", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="application"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} – {self.status}"


class ApplicationPayment(models.Model):
    applicant = models.OneToOneField(
        Applicant, on_delete=models.CASCADE, related_name="payment"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    receipt_number = models.CharField(max_length=100, blank=True)
    payment_date = models.DateField()
    payment_method = models.CharField(
        max_length=30,
        choices=[("cash", "Cash"), ("bank_transfer", "Bank Transfer"), ("mobile", "Mobile Money"), ("other", "Other")],
        default="cash",
    )
    confirmed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment for {self.applicant} — {self.amount}"


class Interview(models.Model):
    RESULT_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("declined", "Declined"),
    ]
    applicant = models.OneToOneField(
        Applicant, on_delete=models.CASCADE, related_name="interview"
    )
    interview_date = models.DateField()
    interviewer = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="interviews_conducted"
    )
    marks = models.IntegerField(null=True, blank=True, help_text="Score out of 100")
    result = models.CharField(max_length=20, choices=RESULT_CHOICES, default="pending")
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Interview: {self.applicant} — {self.result}"

