"""DRF permission classes. The fine-grained per-sub-project engine lands in
step 4 (permissions/engine.py); this module holds the coarse role checks."""

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdmin(BasePermission):
    """Global Admin only."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsAdminOrReadOnly(BasePermission):
    """Any authenticated user may read; only Admins may write. (Object-level
    read visibility is enforced by the per-sub-project engine in step 4.)"""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_admin
