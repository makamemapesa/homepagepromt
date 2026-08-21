from django.core.management.base import BaseCommand

from core import role_sync


class Command(BaseCommand):
    help = (
        "Create/link auth.User and UserProfile for existing Teacher records. "
        "For the full two-way sync (including Teacher records for teacher-role "
        "users) use `manage.py sync_roles` instead."
    )

    def handle(self, *args, **options):
        from academics.models import Teacher

        synced = 0
        skipped = 0

        for teacher in Teacher.objects.all():
            if not (teacher.email or "").strip():
                self.stdout.write(f"Skipping Teacher id={teacher.id} missing email")
                skipped += 1
                continue
            with role_sync.guard():
                role_sync.sync_teacher_to_profile(teacher)
            synced += 1

        self.stdout.write(self.style.SUCCESS(f"Synced: {synced}  Skipped: {skipped}"))
