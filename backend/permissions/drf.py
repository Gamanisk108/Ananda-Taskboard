"""DRF permission classes — coarse role checks. Admin authority is per-org:
it resolves against `request.org` (set by OrgContextMiddleware from X-Org-Id)
via the engine's is_org_admin, so an org's admin only has power inside their
own org, and a superuser has it everywhere. With no org context (legacy/global)
it falls back to the deprecated global role."""

from rest_framework.permissions import BasePermission, SAFE_METHODS


def _is_admin(request):
    from permissions.engine import is_org_admin
    return bool(
        request.user
        and request.user.is_authenticated
        and is_org_admin(request.user, getattr(request, "org", None))
    )


class IsAdmin(BasePermission):
    """Admin of the active org only (or superuser)."""

    def has_permission(self, request, view):
        return _is_admin(request)


class IsAdminOrReadOnly(BasePermission):
    """Any authenticated user may read; only the active org's admin may write."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return _is_admin(request)


class IsSuperUser(BasePermission):
    """Platform owner only. Used for cross-org METADATA (stats/directory) — never
    for org data, which stays gated on real membership."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)
