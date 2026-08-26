from rest_framework.permissions import SAFE_METHODS, BasePermission
from .utils import get_user_role


class RoleAccess(BasePermission):
    """Base for "these roles may write, these may read" rules.

    Subclasses set ``WRITE_ROLES`` and ``READ_ROLES``; ``READ_ROLES`` is taken to
    include everyone who may write, so only the extra readers need listing.

    Every viewset still scopes *which rows* a role sees in ``get_queryset`` —
    this only decides who gets through the door.
    """

    WRITE_ROLES: tuple = ()
    READ_ROLES: tuple = ()

    def has_permission(self, request, view):
        role = get_user_role(request.user)
        if role in self.WRITE_ROLES:
            return True
        return request.method in SAFE_METHODS and role in self.READ_ROLES


class CanReadAcademicReference(RoleAccess):
    """Classes, subjects, timetables and the calendar.

    This is reference data: everyone who works in the school needs to be able to
    name a class or read the bell schedule — the accountant billing it, the
    parent opening a report card, the staff member checking a room. Keeping it
    behind the teacher role meant the accountant's and parent's class pickers
    came back empty, and every screen that starts with "choose a class" was dead
    for them. Writes stay where they were; each viewset narrows them further in
    its own ``get_permissions``.
    """

    WRITE_ROLES = ("super_admin", "admin", "teacher")
    READ_ROLES = WRITE_ROLES + ("accountant", "parent", "staff")


class CanReadExamRecords(RoleAccess):
    """Marks and results: taught by teachers, read by the office and by parents.

    Accountants are readers because releasing a report card is fee-gated — they
    confirm the payment that unlocks it, so they need to see what is being
    released. They cannot enter or alter a mark.
    """

    WRITE_ROLES = ("super_admin", "admin", "teacher")
    READ_ROLES = WRITE_ROLES + ("accountant", "parent")


class CanReadTeacherDirectory(RoleAccess):
    """Staff names, for the pickers that attribute work to a colleague.

    Teachers could not read this, so the teacher column on the timetable, the
    class-teacher name on a report card and the author picker on a lesson plan
    were all blank for them — the one role that uses those screens most.
    """

    WRITE_ROLES = ("super_admin", "admin")
    READ_ROLES = WRITE_ROLES + ("teacher",)


class IsSuperAdmin(BasePermission):
    """
    Permission check for Super Administrator role.
    Has full access to everything in the system.
    """
    def has_permission(self, request, view):
        return get_user_role(request.user) == 'super_admin'


class IsSuperAdminOrAdmin(BasePermission):
    """
    Permission check for Super Admin or School Administrator.
    Used for student management, academic settings, etc.
    """
    def has_permission(self, request, view):
        return get_user_role(request.user) in ['super_admin', 'admin']


class IsTeacher(BasePermission):
    """
    Permission check for Teacher role.
    Teachers can manage their own classes, attendance, marks, lesson plans.
    """
    def has_permission(self, request, view):
        return get_user_role(request.user) == 'teacher'


class IsTeacherOrAdmin(BasePermission):
    """
    Permission for teachers and administrators.
    Used for academic operations like attendance, marks entry.
    """
    def has_permission(self, request, view):
        return get_user_role(request.user) in ['teacher', 'admin', 'super_admin']


class IsAccountant(BasePermission):
    """
    Permission check for Accountant role.
    Accountants manage fees and payments only.
    """
    def has_permission(self, request, view):
        return get_user_role(request.user) == 'accountant'


class IsAccountantOrAdmin(BasePermission):
    """
    Permission for accountants and administrators.
    Used for fee and payment management.
    """
    def has_permission(self, request, view):
        return get_user_role(request.user) in ['accountant', 'admin', 'super_admin']


class IsParent(BasePermission):
    """
    Permission check for Parent role.
    Parents can only view their own children's data.
    """
    def has_permission(self, request, view):
        return get_user_role(request.user) == 'parent'


class ReadOnly(BasePermission):
    """
    Permission for read-only access.
    Used for parents and students to view data without modification.
    """
    def has_permission(self, request, view):
        return request.method in ['GET', 'HEAD', 'OPTIONS']


class IsTeacherOrAdminOrParentReadOnly(BasePermission):
    """
    Combined permission: Teachers and Admins have full access, Parents can only read.
    """
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        if role in ['teacher', 'admin', 'super_admin']:
            return True
        if role == 'parent' and request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        return False


class IsSchoolStaffOrParentReadOnly(BasePermission):
    """Any staff role may read student records; parents may read their own.

    Accountants are included because recording a payment starts by looking the
    student up — StudentViewSet.get_queryset already scopes what each role
    actually sees, and writes are routed to admin-only permissions separately.
    """
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        if role in ['teacher', 'admin', 'super_admin', 'accountant']:
            return True
        if role == 'parent' and request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        return False


class IsAccountantOrAdminOrParentReadOnly(BasePermission):
    """
    Combined permission: Accountants and Admins have full access, Parents can only read.
    """
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        if role in ['accountant', 'admin', 'super_admin']:
            return True
        if role == 'parent' and request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        return False

