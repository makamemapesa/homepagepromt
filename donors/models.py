from django.db import models


class Donor(models.Model):
    TYPE_CHOICES = [
        ("Foundation", "Foundation"),
        ("Trust", "Trust"),
        ("Individual", "Individual"),
        ("NGO", "NGO"),
        ("Alumni Group", "Alumni Group"),
    ]
    STATUS_CHOICES = [("active", "Active"), ("inactive", "Inactive")]

    name = models.CharField(max_length=200)
    contact = models.CharField(max_length=200, help_text="Contact person name")
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    total_donated = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def active_students(self):
        return self.sponsored_students.filter(status="active").count()
