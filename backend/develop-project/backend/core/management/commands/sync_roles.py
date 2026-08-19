from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from core import role_sync
from core.models import UserProfile


class Command(BaseCommand):
    help = (
        "Bring existing data in line with the role mapping: give every "
        "teacher-role user an academics.Teacher record, give every Teacher "
        "record a login account carrying the teacher role, and link parent "
        "users to guardian records waiting on a login."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing anything.",
        )

    def handle(self, *args, **options):
        from academics.models import Teacher

        dry_run = options["dry_run"]
        made_teacher_records = []
        made_accounts = []
        fixed_roles = []
        linked_guardians = 0

        # ── User Management → Teacher panel ──────────────────────────────
        for profile in UserProfile.objects.filter(role="teacher").select_related("user"):
            email = role_sync.account_email(profile.user)
            if not email:
                self.stdout.write(
                    self.style.WARNING(f"  skipped user #{profile.user_id} — no e-mail address")
                )
                continue
            if Teacher.objects.filter(email__iexact=email).exists():
                continue
            made_teacher_records.append(email)
            if not dry_run:
                with role_sync.guard():
                    role_sync.ensure_teacher_record(profile.user)

        # ── Teacher panel → User Management ──────────────────────────────
        for teacher in Teacher.objects.all():
            email = (teacher.email or "").strip()
            if not email:
                self.stdout.write(
                    self.style.WARNING(f"  skipped Teacher #{teacher.pk} — no e-mail address")
                )
                continue
            user = (
                User.objects.filter(username__iexact=email).first()
                or User.objects.filter(email__iexact=email).first()
            )
            if user is None:
                made_accounts.append(email)
            else:
                role = getattr(getattr(user, "profile", None), "role", None)
                if role != "teacher" and role not in role_sync.PRIVILEGED_ROLES:
                    fixed_roles.append(f"{email} ({role} → teacher)")
                elif role in role_sync.PRIVILEGED_ROLES:
                    self.stdout.write(
                        f"  kept {email} as {role} (administrators are never demoted)"
                    )
                    continue
                else:
                    continue
            if not dry_run:
                with role_sync.guard():
                    role_sync.sync_teacher_to_profile(teacher)

        # ── Parent users → guardian records ──────────────────────────────
        for profile in UserProfile.objects.filter(role="parent").select_related("user"):
            if dry_run:
                from students.models import ParentGuardian

                email = role_sync.account_email(profile.user)
                if email:
                    linked_guardians += ParentGuardian.objects.filter(
                        user__isnull=True, email__iexact=email
                    ).count()
            else:
                with role_sync.guard():
                    linked_guardians += role_sync.link_parent_guardians(profile.user)

        for email in made_teacher_records:
            self.stdout.write(f"  Teacher record for {email}")
        for email in made_accounts:
            self.stdout.write(f"  login account for {email}")
        for line in fixed_roles:
            self.stdout.write(f"  role corrected: {line}")

        summary = (
            f"Teacher records created: {len(made_teacher_records)}  "
            f"Accounts created: {len(made_accounts)}  "
            f"Roles corrected: {len(fixed_roles)}  "
            f"Guardians linked: {linked_guardians}"
        )
        if dry_run:
            self.stdout.write(self.style.WARNING(f"DRY RUN — nothing written. {summary}"))
        else:
            self.stdout.write(self.style.SUCCESS(summary))
