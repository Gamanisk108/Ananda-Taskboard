from rest_framework import serializers

from .models import Group, Tier, User


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
        fields = ["id", "email", "name", "role", "is_admin", "is_active", "tier", "language", "theme", "daily_push_enabled"]


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


class GroupSerializer(serializers.ModelSerializer):
    member_ids = serializers.PrimaryKeyRelatedField(
        source="members", many=True, queryset=User.objects.all(), required=False
    )

    class Meta:
        model = Group
        fields = ["id", "name", "member_ids"]
