from django.db import models
from students.models import Student


class FeeStructure(models.Model):
    """Fee breakdown per class level per session."""
    class_level = models.CharField(max_length=50, help_text="e.g. JSS 1, SS 2")
    session = models.CharField(max_length=20, default="2026")
    tuition = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    boarding = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    development = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    books = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ["class_level"]
        unique_together = ["class_level", "session"]

    def __str__(self):
        return f"{self.class_level} — {self.session}"

    @property
    def total(self):
        return self.tuition + self.boarding + self.development + self.books


class Payment(models.Model):
    METHOD_CHOICES = [
        ("Bank Transfer", "Bank Transfer"),
        ("Cash", "Cash"),
        ("Mobile Money", "Mobile Money"),
        ("Online", "Online"),
        ("Cheque", "Cheque"),
    ]
    STATUS_CHOICES = [
        ("confirmed", "Confirmed"),
        ("pending", "Pending"),
        ("failed", "Failed"),
    ]
    CATEGORY_CHOICES = [
        ("Full Payment", "Full Payment"),
        ("Tuition", "Tuition"),
        ("Boarding", "Boarding"),
        ("Development Levy", "Development Levy"),
        ("Books & Stationery", "Books & Stationery"),
        ("Miscellaneous", "Miscellaneous"),
    ]

    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField(db_index=True)
    method = models.CharField(max_length=30, choices=METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)
    term = models.CharField(max_length=50, default="Term 2, 2026", db_index=True)
    receipt_no = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default="Full Payment")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.student} — TSh {self.amount} ({self.status})"
