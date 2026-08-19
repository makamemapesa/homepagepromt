"""
Keep portal roles and their domain records in step.

A "teacher" can come into existence in two different places:

  * User Management  — an ``auth.User`` + ``UserProfile(role="teacher")``
  * the Teacher panel — an ``academics.Teacher`` row

Each one has to produce the other. Without the Teacher row a teacher can log
in but every teacher-scoped queryset comes back empty, because they all
resolve the teacher by e-mail (``Teacher.objects.get(email=user.email)``).
Without the login account a teacher exists on paper with no way to sign in.

Roles that have no domain table of their own — ``admin``, ``super_admin``,
``accountant``, ``staff`` — need nothing here: the role on the profile is what
grants them their section, both in the sidebar and in the API permissions.

Parents are a special case. A ``ParentGuardian`` hangs off a ``Student``, so
one cannot be conjured from a user account alone; instead a parent user is
*linked* to any guardian records that are still waiting for a login.

Everything runs under `guard()` so the two directions cannot bounce off each
other: whichever side fires first does the whole job, and the signals on the
other side stand down for the duration.
"""
import threading

from django.contrib.auth.models import User

from .models import UserProfile

# Roles that must never be silently demoted. The profile holds a single role,
# so it cannot express "an administrator who also teaches" — and an admin
# already has full access to every teacher-facing endpoint, so keeping the
# administrator role loses them nothing.
PRIVILEGED_ROLES = {"super_admin", "admin"}

# Assigned to auto-created profiles that nobody has given a real role yet.
# "staff" is deliberately the role with no sidebar entries and no API
# permissions, so a forgotten code path grants nothing.
FALLBACK_ROLE = "staff"

_state = threading.local()


def is_syncing() -> bool:
    return getattr(_state, "active", False)


class guard:
    """Re-entrancy guard shared by both directions of the sync."""

    def __enter__(self):
        _state.active = True
        return self

    def __exit__(self, *exc):
        _state.active = False
        return False


def split_name(full_name: str):
    """Split a display name into (first_name, last_name)."""
    parts = (full_name or "").strip().split()
    if not parts:
        return "", ""
    return parts[0], " ".join(parts[1:])


def account_email(user: User) -> str:
    """The address every teacher lookup keys on."""
    return (user.email or user.username or "").strip()


# ── User / profile  →  domain record ──────────────────────────────────────

def ensure_teacher_record(user: User):
    """Give a teacher-role user the academics.Teacher row their panel needs."""
    from academics.models import Teacher

    email = account_email(user)
    if not email:
        return None

    teacher = Teacher.objects.filter(email__iexact=email).first()
    display_name = user.get_full_name().strip() or email

    if teacher is None:
        return Teacher.objects.create(email=email, name=display_name, status="active")

    updates = {}
    if teacher.status != "active":
        # They were demoted at some point and are a teacher again.
        updates["status"] = "active"
    if not (teacher.name or "").strip():
        updates["name"] = display_name
    if updates:
        # .update() so this does not re-trigger the Teacher post_save handler.
        Teacher.objects.filter(pk=teacher.pk).update(**updates)
        teacher.refresh_from_db()
    return teacher


def retire_teacher_record(email: str):
    """Someone stopped being a teacher — stand their Teacher row down.

    Deliberately *not* a delete: assignments, timetable slots and marks all
    hang off this row, and the change is reversible.
    """
    from academics.models import Teacher

    if not email:
        return
    Teacher.objects.filter(email__iexact=email).exclude(status="inactive").update(status="inactive")


def link_parent_guardians(user: User):
    """Attach any guardian records that were waiting for this parent's login."""
    from students.models import ParentGuardian

    email = account_email(user)
    if not email:
        return 0
    return ParentGuardian.objects.filter(user__isnull=True, email__iexact=email).update(user=user)


def sync_profile_to_domain(profile: UserProfile, previous_role=None):
    """Bring the domain records in line with the role now on the profile."""
    user = profile.user
    role = profile.role

    if role == "teacher":
        ensure_teacher_record(user)
    elif previous_role == "teacher":
        # Only on an actual change, so re-saving an admin who also happens to
        # have a Teacher row does not quietly retire them.
        retire_teacher_record(account_email(user))

    if role == "parent":
        link_parent_guardians(user)


# ── Domain record  →  user / profile ──────────────────────────────────────

def sync_teacher_to_profile(teacher):
    """Give an academics.Teacher the login account and role they need."""
    email = (teacher.email or "").strip()
    if not email:
        return None

    user = (
        User.objects.filter(username__iexact=email).first()
        or User.objects.filter(email__iexact=email).first()
    )

    created_user = False
    if user is None:
        first, last = split_name(teacher.name)
        user = User.objects.create_user(
            username=email, email=email, first_name=first, last_name=last
        )
        # No password yet — an admin sets one from User Management.
        user.set_unusable_password()
        user.save(update_fields=["password"])
        created_user = True
    elif not user.get_full_name().strip():
        first, last = split_name(teacher.name)
        if first or last:
            User.objects.filter(pk=user.pk).update(first_name=first, last_name=last)

    profile, _ = UserProfile.objects.get_or_create(user=user, defaults={"role": "teacher"})

    if created_user:
        # A brand-new account that exists only to back this Teacher row.
        target = "teacher"
    elif profile.role in PRIVILEGED_ROLES:
        target = profile.role  # never demote an administrator
    else:
        target = "teacher"

    if profile.role != target:
        profile.role = target
        profile.save(update_fields=["role"])

    return user


def sync_teacher_email(old_email: str, new_email: str):
    """Follow a user's e-mail change so their Teacher row stays findable."""
    from academics.models import Teacher

    old_email = (old_email or "").strip()
    new_email = (new_email or "").strip()
    if not old_email or not new_email or old_email.lower() == new_email.lower():
        return
    if Teacher.objects.filter(email__iexact=new_email).exists():
        return  # a teacher already owns the new address — leave both alone
    Teacher.objects.filter(email__iexact=old_email).update(email=new_email)
