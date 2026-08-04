from django.db.models.signals import post_save, post_migrate
from django.dispatch import receiver
from django.contrib.auth.models import User

from .models import UserProfile


def _get_default_role(user: User) -> str:
    return "super_admin" if user.is_superuser else "admin"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Automatically create a UserProfile when a new User is created.

    - If the user is a Django superuser (`is_superuser=True`) assign
      the `super_admin` role.
    - Otherwise default to `admin` so portal users have a sensible role.
    """
    if not created:
        return

    # Avoid double-creation if a profile already exists for any reason.
    # Use get_or_create so repeated signals or explicit test creates won't raise IntegrityError.
    role = _get_default_role(instance)
    UserProfile.objects.get_or_create(user=instance, defaults={"role": role})


@receiver(post_migrate)
def ensure_superuser_profiles(sender, **kwargs):
    """Backfill missing profiles for existing superusers after migrations."""
    if sender.name != "core":
        return

    for user in User.objects.filter(is_superuser=True).filter(profile__isnull=True):
        UserProfile.objects.get_or_create(user=user, defaults={"role": "super_admin"})
