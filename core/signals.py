from django.db.models.signals import post_save, pre_save, post_migrate
from django.dispatch import receiver
from django.contrib.auth.models import User

from . import role_sync
from .models import UserProfile


def _get_default_role(user: User) -> str:
    """Role given to a profile nobody has explicitly assigned one to.

    Superusers get the run of the place. Everyone else starts on the role with
    no sidebar entries and no API permissions — the caller that created the
    user is expected to set the real role immediately afterwards, and if one
    ever forgets, the account grants nothing instead of full admin.
    """
    return "super_admin" if user.is_superuser else role_sync.FALLBACK_ROLE


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Automatically create a UserProfile when a new User is created."""
    if not created:
        return

    # Use get_or_create so repeated signals or explicit test creates won't raise IntegrityError.
    UserProfile.objects.get_or_create(
        user=instance, defaults={"role": _get_default_role(instance)}
    )


@receiver(pre_save, sender=User)
def remember_previous_email(sender, instance, **kwargs):
    """Stash the stored e-mail so post_save can tell whether it changed."""
    if not instance.pk:
        instance._previous_email = None
        return
    instance._previous_email = (
        User.objects.filter(pk=instance.pk).values_list("email", flat=True).first()
    )


@receiver(post_save, sender=User)
def follow_email_change(sender, instance, created, **kwargs):
    """Teacher rows are found by e-mail — keep them reachable after a rename."""
    if created or role_sync.is_syncing():
        return
    previous = getattr(instance, "_previous_email", None)
    if not previous or previous == instance.email:
        return
    role = getattr(getattr(instance, "profile", None), "role", None)
    if role != "teacher":
        return
    with role_sync.guard():
        role_sync.sync_teacher_email(previous, instance.email)


@receiver(pre_save, sender=UserProfile)
def remember_previous_role(sender, instance, **kwargs):
    """Stash the stored role so post_save can act on an actual change."""
    if not instance.pk:
        instance._previous_role = None
        return
    instance._previous_role = (
        UserProfile.objects.filter(pk=instance.pk).values_list("role", flat=True).first()
    )


@receiver(post_save, sender=UserProfile)
def sync_role_to_domain_records(sender, instance, **kwargs):
    """Whatever role a user is given, give them the records that section needs.

    Runs for every path that touches a profile — the User Management API, the
    Django admin, management commands and the shell alike.
    """
    if role_sync.is_syncing():
        return
    with role_sync.guard():
        role_sync.sync_profile_to_domain(
            instance, previous_role=getattr(instance, "_previous_role", None)
        )


@receiver(post_migrate)
def ensure_superuser_profiles(sender, **kwargs):
    """Backfill missing profiles for existing superusers after migrations."""
    if sender.name != "core":
        return

    for user in User.objects.filter(is_superuser=True).filter(profile__isnull=True):
        UserProfile.objects.get_or_create(user=user, defaults={"role": "super_admin"})
