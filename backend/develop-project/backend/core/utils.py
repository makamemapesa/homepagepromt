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
