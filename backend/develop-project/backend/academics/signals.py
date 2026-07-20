from django.db.models import Count, Q
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.conf import settings
from django.contrib.auth.models import User

from core.models import UserProfile


# Ensure that when a Teacher is created, an auth.User + UserProfile exist
# so that teachers appear in the central User management list.
@receiver(post_save, sender="academics.Teacher")
def create_auth_user_for_teacher(sender, instance, created, **kwargs):
    # If a teacher with this email should have a login, create/link User
    if not instance.email:
        return
    user = User.objects.filter(username=instance.email).first()
    if user:
        # Ensure profile role is teacher
        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.role != "teacher":
            profile.role = "teacher"
            profile.save()
    else:
        # Create a non-staff user with unusable password; admins can set password later
        user = User.objects.create_user(username=instance.email, email=instance.email)
        user.set_unusable_password()
        user.save()
        UserProfile.objects.get_or_create(user=user, defaults={"role": "teacher"})


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
