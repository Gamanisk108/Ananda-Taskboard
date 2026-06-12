from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Group, Invitation, Tier, User


class InvitationSerializer(serializers.ModelSerializer):
    tier_name = serializers.CharField(source="tier.name", read_only=True, default=None)
    invited_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = ["id", "email", "role", "tier", "tier_name", "access", "status", "invited_by_name", "created_at"]
        read_only_fields = ["status", "created_at"]

    def get_invited_by_name(self, obj):
        return (obj.invited_by.name or obj.invited_by.email) if obj.invited_by else None


class TierSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Tier
        fields = ["id", "name", "default_sees", "member_count"]

    def get_member_count(self, obj):
        return obj.users.count()


class UserSerializer(serializers.ModelSerializer):
    is_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "name", "role", "is_admin", "is_active", "tier", "language", "theme",
                  "daily_push_enabled", "deadline_reminders", "assignment_changes"]


class UserWriteSerializer(serializers.ModelSerializer):
    """Admin create/update of team members. Password is write-only; on create it
    is required, on update it is optional (reset)."""

    password = serializers.CharField(write_only=True, required=False, allow_blank=False, min_length=8)

    class Meta:
        model = User
        fields = ["id", "email", "name", "role", "is_active", "password", "tier", "language"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "Password is required for a new member."})
        role = validated_data.get("role", User.Role.MEMBER)
        is_admin = role == User.Role.ADMIN
        return User.objects.create_user(
            email=validated_data["email"],
            name=validated_data.get("name", ""),
            password=password,
            role=role,
            tier=validated_data.get("tier"),
            is_staff=is_admin,
            is_superuser=is_admin,
        )

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if "role" in validated_data:
            instance.is_staff = instance.is_superuser = (instance.role == User.Role.ADMIN)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class SignupSerializer(serializers.Serializer):
    """Self-serve signup: a person creates their own account + a new org (which
    they'll admin). Account/org stay inactive until they verify their email."""

    organization = serializers.CharField(max_length=200)
    name = serializers.CharField(max_length=200)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    city = serializers.CharField(max_length=120, required=False, allow_blank=True)
    state = serializers.CharField(max_length=120, required=False, allow_blank=True)
    country = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email=value).exists():
            # Inviting an existing account into a new org is Phase 2; for now, ask
            # them to log in rather than silently colliding.
            raise serializers.ValidationError("An account with this email already exists. Please log in.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value


class GroupSerializer(serializers.ModelSerializer):
    member_ids = serializers.PrimaryKeyRelatedField(
        source="members", many=True, queryset=User.objects.all(), required=False
    )

    class Meta:
        model = Group
        fields = ["id", "name", "member_ids"]
