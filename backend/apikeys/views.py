"""API-key management endpoints (org admins only).

    GET    /api/apikeys        list this org's keys (metadata only)
    POST   /api/apikeys        mint a key -> returns the secret ONCE
    DELETE /api/apikeys/<id>   revoke a key (soft; kept for audit)

Deliberately JWT-only (authentication_classes below): key management requires a
real logged-in admin session. An API key — even read_write — can NOT mint or
revoke keys, so a leaked key can never escalate into more keys.
"""

from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from permissions.drf import IsAdmin
from permissions.models import audit

from .models import ApiKey
from .serializers import ApiKeyCreateSerializer, ApiKeySerializer


def _org(request):
    return getattr(request, "org", None)


class ApiKeyViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]  # never manageable via an API key
    permission_classes = [IsAdmin]
    http_method_names = ["get", "post", "delete", "head", "options"]
    serializer_class = ApiKeySerializer

    def get_queryset(self):
        org = _org(self.request)
        if org is None:
            return ApiKey.objects.none()
        return ApiKey.objects.filter(organization=org).select_related("created_by")

    def create(self, request, *args, **kwargs):
        org = _org(request)
        if org is None:
            raise ValidationError({"detail": "No active organization."})
        ser = ApiKeyCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        key, raw = ApiKey.generate(
            organization=org,
            created_by=request.user,
            name=ser.validated_data["name"],
            scope=ser.validated_data["scope"],
            expires_at=ser.validated_data.get("expires_at"),
        )
        audit(request.user, "apikey.create", f"Created API key '{key.name}' ({key.scope})")
        data = ApiKeySerializer(key).data
        # The full secret is returned exactly once, here, and never again.
        data["key"] = raw
        return Response(data, status=201)

    def destroy(self, request, *args, **kwargs):
        key = self.get_object()  # get_queryset already scopes to this org
        key.revoke()
        audit(request.user, "apikey.revoke", f"Revoked API key '{key.name}'")
        return Response(status=204)
