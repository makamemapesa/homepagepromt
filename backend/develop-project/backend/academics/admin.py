from django.contrib import admin
from .models import Subject, Teacher, Class, TeacherAssignment, Timetable, Attendance, LessonPlan, AcademicCalendar


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "department", "status"]
    list_filter = ["department", "status"]
    search_fields = ["name", "email"]


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ["name", "section", "capacity", "class_teacher", "status"]
    list_filter = ["section", "status"]


admin.site.register(Subject)
admin.site.register(TeacherAssignment)
admin.site.register(Timetable)
admin.site.register(Attendance)
admin.site.register(LessonPlan)
admin.site.register(AcademicCalendar)
