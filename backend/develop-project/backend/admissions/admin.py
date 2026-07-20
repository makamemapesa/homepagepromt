from django.contrib import admin
from .models import AdmissionWindow, Applicant, ApplicationPayment, Interview


@admin.register(AdmissionWindow)
class AdmissionWindowAdmin(admin.ModelAdmin):
    list_display = ["academic_session", "open_date", "close_date", "is_active", "application_fee"]
    list_filter = ["is_active"]


@admin.register(Applicant)
class ApplicantAdmin(admin.ModelAdmin):
    list_display = ["first_name", "last_name", "applying_for_class", "status", "application_date"]
    list_filter = ["status", "academic_session", "gender"]
    search_fields = ["first_name", "last_name", "parent_name", "parent_email"]


@admin.register(ApplicationPayment)
class ApplicationPaymentAdmin(admin.ModelAdmin):
    list_display = ["applicant", "amount", "payment_date", "payment_method"]


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ["applicant", "interview_date", "marks", "result"]
    list_filter = ["result"]

