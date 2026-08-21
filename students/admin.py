from django.contrib import admin
from .models import Student, ParentGuardian, StudentDocument, AcademicHistory, EmergencyContact


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ["reg_no", "first_name", "last_name", "student_class", "status", "fee_status"]
    list_filter = ["status", "fee_status", "gender", "student_type"]
    search_fields = ["reg_no", "first_name", "last_name"]


admin.site.register(ParentGuardian)
admin.site.register(StudentDocument)
admin.site.register(AcademicHistory)
admin.site.register(EmergencyContact)
