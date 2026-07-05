from rest_framework import serializers

from .models import ApiKey


class ApiKeySerializer(serializers.ModelSerializer):
    """Read serializer — metadata only. NEVER exposes the secret or its hash."""

    created_by_name = serializers.SerializerMethodField()
    masked_key = serializers.SerializerMethodField()
    status = serializers.CharField(read_only=True)

    class Meta:
        model = ApiKey
        fields = [
            "id", "name", "scope", "prefix", "masked_key",
            "created_by_name", "created_at", "last_used_at",
            "expires_at", "revoked_at", "status",
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        u = obj.created_by
        return (u.name or u.email) if u else "—"

    def get_masked_key(self, obj):
        return f"{obj.prefix}{'•' * 8}"


class ApiKeyCreateSerializer(serializers.Serializer):
    """Write serializer for minting a key. Scope is limited to the two sensible
    levels; write-only is deliberately not offered (see build doc)."""

    name = serializers.CharField(max_length=120)
    scope = serializers.ChoiceField(
        choices=[ApiKey.Scope.READ, ApiKey.Scope.READ_WRITE],
        default=ApiKey.Scope.READ_WRITE,
    )
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_name(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("A name is required.")
        return v

    def validate_expires_at(self, v):
        from django.utils import timezone

        if v is not None and v <= timezone.now():
            raise serializers.ValidationError("Expiry must be in the future.")
        return v
