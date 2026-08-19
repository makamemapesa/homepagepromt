from django.db.models import Count, Q
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from core import role_sync


# A Teacher created in the Teacher panel must get a login account carrying the
# teacher role, so they appear in User Management and can reach their section.
# The rules live in core.role_sync, which drives the opposite direction too.
@receiver(post_save, sender="academics.Teacher")
def create_auth_user_for_teacher(sender, instance, created, **kwargs):
    if role_sync.is_syncing():
        return
    with role_sync.guard():
        role_sync.sync_teacher_to_profile(instance)


def _sync_attendance(date, student_class):
    """Recompute the class-level Attendance aggregate for a given date+class."""
    from .models import Attendance, StudentAttendance

    agg = StudentAttendance.objects.filter(
        date=date, student_class=student_class
    ).aggregate(
        present=Count("id", filter=Q(status="present")),
        absent=Count("id", filter=Q(status="absent")),
        late=Count("id", filter=Q(status="late")),
    )

    Attendance.objects.update_or_create(
        date=date,
        student_class=student_class,
        defaults={
            "present": agg["present"] or 0,
            "absent":  agg["absent"]  or 0,
            "late":    agg["late"]    or 0,
        },
    )


@receiver(post_save, sender="academics.StudentAttendance")
def sync_attendance_on_save(sender, instance, **kwargs):
    _sync_attendance(instance.date, instance.student_class)


@receiver(post_delete, sender="academics.StudentAttendance")
def sync_attendance_on_delete(sender, instance, **kwargs):
    _sync_attendance(instance.date, instance.student_class)
