from rest_framework import serializers

from .models import Group, User


class UserSerializer(serializers.ModelSerializer):
    is_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "name", "role", "is_admin", "is_active"]


class GroupSerializer(serializers.ModelSerializer):
    member_ids = serializers.PrimaryKeyRelatedField(
        source="members", many=True, queryset=User.objects.all(), required=False
    )

    class Meta:
        model = Group
        fields = ["id", "name", "member_ids"]
