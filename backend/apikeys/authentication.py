"""DRF authentication for API keys.

Wire-up (config/settings.py): this sits FIRST in DEFAULT_AUTHENTICATION_CLASSES,
ahead of JWT. If no API-key credential is present it returns None and JWT runs
as normal, so the SPA is unaffected. If a credential IS present it fully governs
the request.

A key is accepted from any of:
    Authorization: Bearer atb_…      (detected by the atb_ prefix)
    Authorization: Api-Key atb_…
    X-Api-Key: atb_…

Two security properties are enforced HERE (not in a per-view permission class),
so they hold no matter what `permission_classes` a view sets:
  1. Org binding — request.org is set from the key, overriding any X-Org-Id
     header. A key for org A can never reach org B.
  2. Scope — a read-only key attempting any unsafe method is rejected 403.
"""

from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.permissions import SAFE_METHODS

from .models import KEY_PREFIX, ApiKey, hash_key


class ApiKeyAuthentication(BaseAuthentication):
    keyword = "Api-Key"

    def authenticate(self, request):
        raw = self._extract(request)
        if not raw:
            return None  # no API-key credential — let JWT (or AllowAny) handle it

        key = (
            ApiKey.objects.filter(hashed_key=hash_key(raw))
            .select_related("organization", "created_by")
            .first()
        )
        if key is None:
            raise exceptions.AuthenticationFailed("Invalid API key.")
        if key.is_revoked:
            raise exceptions.AuthenticationFailed("This API key has been revoked.")
        if key.is_expired:
            raise exceptions.AuthenticationFailed("This API key has expired.")

        user = key.created_by
        if user is None or not user.is_active:
            raise exceptions.AuthenticationFailed("The user for this API key is inactive.")
        if not key.organization.is_active:
            raise exceptions.AuthenticationFailed("The organization for this API key is inactive.")
        # The key can only do what its creator can still do: require a live,
        # active membership in the key's org.
        from permissions.engine import _in_org

        if not _in_org(user, key.organization):
            raise exceptions.AuthenticationFailed(
                "The user for this API key is no longer a member of the organization."
            )

        # (1) Bind org from the KEY, overriding whatever OrgContextMiddleware read
        # from an X-Org-Id header. request.org is read off the underlying
        # HttpRequest, so set it there.
        request._request.org = key.organization
        request._request.api_key = key
        request._request.api_scope = key.scope

        # (2) Scope gate — read-only keys may not write. Enforced at the auth
        # layer so it survives any per-view permission override. PermissionDenied
        # → 403 (authenticated but not allowed), not 401.
        if key.scope == ApiKey.Scope.READ and request.method not in SAFE_METHODS:
            raise exceptions.PermissionDenied("This API key is read-only.")

        key.touch_last_used()
        return (user, key)

    def authenticate_header(self, request):
        # Drives the WWW-Authenticate header on a 401 from this authenticator.
        return self.keyword

    @staticmethod
    def _extract(request):
        """Pull a raw key out of the request, or return None."""
        direct = request.headers.get("X-Api-Key")
        if direct:
            return direct.strip()

        auth = get_authorization_header(request).split()
        if len(auth) != 2:
            return None
        scheme, value = auth[0].decode("latin-1"), auth[1].decode("latin-1")
        scheme = scheme.lower()
        if scheme in ("api-key", "apikey"):
            return value.strip()
        # Bearer is shared with JWT — only claim it when it's clearly our key.
        if scheme == "bearer" and value.startswith(KEY_PREFIX):
            return value.strip()
        return None
