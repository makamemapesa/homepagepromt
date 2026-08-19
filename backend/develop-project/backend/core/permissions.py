from rest_framework.permissions import BasePermission
from .utils import get_user_role


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

