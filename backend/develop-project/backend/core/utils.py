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


def get_teacher_homeroom_class_ids(teacher) -> set:
    """Classes this teacher is the *class teacher* of.

    Deliberately narrower than :func:`get_teacher_class_ids`, which also counts
    every class the teacher merely takes a subject in. A register belongs to the
    class teacher, so this is the set that decides who may change one — sharing
    a classroom for one period a week is not the same responsibility.

    Returns an empty set for an unknown teacher, so callers can filter on it
    without a separate None check.
    """
    from academics.models import Class

    if teacher is None:
        return set()
    return set(
        Class.objects.filter(class_teacher=teacher).values_list("id", flat=True)
    )


def get_teacher_class_ids(teacher) -> set:
    """Classes a teacher is responsible for: homeroom plus active assignments.

    Returns an empty set for an unknown teacher, so callers can filter on it
    without a separate None check.
    """
    from academics.models import TeacherAssignment

    if teacher is None:
        return set()
    assigned_ids = set(
        TeacherAssignment.objects.filter(teacher=teacher, status="active")
        .values_list("student_class_id", flat=True)
    )
    return get_teacher_homeroom_class_ids(teacher) | assigned_ids


def get_teacher_subject_pairs(teacher) -> set:
    """``(class_id, subject_id)`` pairs a teacher actually teaches.

    This is the finest scope the school records: a ``TeacherAssignment`` names
    one subject in one class. Marks entry uses it, because taking Mathematics in
    Form 1A is no licence to enter that class's English scores — which is what
    :func:`get_teacher_class_ids` alone would allow, since it collapses every
    assignment down to its class.

    Homeroom is deliberately *not* folded in. Being class teacher is a pastoral
    responsibility, not a claim on every subject's marks; where a class teacher
    does teach the class, an assignment row says so.
    """
    from academics.models import TeacherAssignment

    if teacher is None:
        return set()
    return set(
        TeacherAssignment.objects.filter(teacher=teacher, status="active")
        .values_list("student_class_id", "subject_id")
    )
