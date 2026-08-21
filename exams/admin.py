from django.contrib import admin
from .models import ExamMark, ExamResult, SubjectResult


@admin.register(ExamMark)
class ExamMarkAdmin(admin.ModelAdmin):
    list_display = ["student", "subject", "student_class", "term", "exam_type", "score"]
    list_filter = ["term", "exam_type", "academic_session", "student_class"]
    search_fields = ["student__first_name", "student__last_name"]


@admin.register(ExamResult)
class ExamResultAdmin(admin.ModelAdmin):
    list_display = ["student", "student_class", "term", "average", "grade", "position"]
    list_filter = ["term", "academic_session", "student_class"]


admin.site.register(SubjectResult)
