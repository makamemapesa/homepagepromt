from typing import Optional
from django.contrib.auth.models import User


def get_user_role(user: Optional[User]) -> Optional[str]:
    """Safely return the role string for a User or None.

    - Returns None if `user` is falsy or not authenticated.
    - If the user has no profile but is a Django superuser, returns
      `super_admin` so built-in superusers still have access.
    - Catches any exceptions when accessing the reverse OneToOne `profile`.
    """
    if not user:
        return None
    try:
        if not getattr(user, "is_authenticated", False):
            return None
        profile = getattr(user, "profile", None)
        if profile is not None:
            return getattr(profile, "role", None)
        if getattr(user, "is_superuser", False):
            return "super_admin"
        if getattr(user, "is_staff", False):
            return "admin"
        return None
    except Exception:
        return None


def get_teacher_for(user) -> Optional["object"]:
    """Resolve the ``academics.Teacher`` row behind a signed-in user, or None.

    Matched case-insensitively on e-mail, because that is how ``core.role_sync``
    links the two records — the Teacher row and the login are created by
    different screens, so "JHassan@school.edu" and "jhassan@school.edu" are one
    person. An exact match here reports the teacher as unknown, which every
    caller renders as an empty screen rather than as an error.
    """
    from academics.models import Teacher

    email = (getattr(user, "email", "") or "").strip()
    if not email:
        return None
    return Teacher.objects.filter(email__iexact=email).first()


def get_teacher_class_ids(teacher) -> set:
    """Classes a teacher is responsible for: homeroom plus active assignments.

    Returns an empty set for an unknown teacher, so callers can filter on it
    without a separate None check.
    """
    from academics.models import Class, TeacherAssignment

    if teacher is None:
        return set()
    homeroom_ids = set(
        Class.objects.filter(class_teacher=teacher).values_list("id", flat=True)
    )
    assigned_ids = set(
        TeacherAssignment.objects.filter(teacher=teacher, status="active")
        .values_list("student_class_id", flat=True)
    )
    return homeroom_ids | assigned_ids
