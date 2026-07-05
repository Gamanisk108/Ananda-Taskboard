"""Belt-and-suspenders scope enforcement.

The authoritative read/write gate for API keys lives in
`ApiKeyAuthentication.authenticate` (so it applies to EVERY view). This
permission class is a secondary layer, added to DRF's DEFAULT_PERMISSION_CLASSES:
for any view that uses the default permissions, a read-only key is blocked from
unsafe methods here too. It is a no-op for normal (JWT/session) requests.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import ApiKey


class ApiKeyScopePermission(BasePermission):
    message = "This API key is read-only."

    def has_permission(self, request, view):
        scope = getattr(request, "api_scope", None)
        if scope is None:
            return True  # not an API-key request
        if scope == ApiKey.Scope.READ and request.method not in SAFE_METHODS:
            return False
        return True
