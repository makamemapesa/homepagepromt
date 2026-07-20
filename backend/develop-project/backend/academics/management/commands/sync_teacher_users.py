from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create/link auth.User and UserProfile for existing Teacher records"

    def handle(self, *args, **options):
        from academics.models import Teacher
        from django.contrib.auth.models import User
        from core.models import UserProfile

        created = 0
        updated = 0
        skipped = 0

        for t in Teacher.objects.all():
            email = (t.email or '').strip()
            if not email:
                self.stdout.write(f"Skipping Teacher id={t.id} missing email")
                skipped += 1
                continue
            user = User.objects.filter(username=email).first()
            if user:
                profile, _ = UserProfile.objects.get_or_create(user=user)
                if profile.role != 'teacher':
                    profile.role = 'teacher'
                    profile.save()
                    updated += 1
                else:
                    skipped += 1
            else:
                user = User.objects.create_user(username=email, email=email)
                user.set_unusable_password()
                user.save()
                UserProfile.objects.get_or_create(user=user, defaults={'role': 'teacher'})
                created += 1

        self.stdout.write(self.style.SUCCESS(f"Created: {created} Updated: {updated} Skipped: {skipped}"))
