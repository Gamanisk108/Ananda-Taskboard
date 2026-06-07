from rest_framework import serializers

from .models import Project, SubProject


class SubProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubProject
        fields = [
            "id", "project", "name", "color", "description",
            "members_post_without_approval", "is_default", "created_at",
        ]
        read_only_fields = ["is_default", "created_at"]


class ProjectSerializer(serializers.ModelSerializer):
    subprojects = SubProjectSerializer(many=True, read_only=True)
    display_emoji = serializers.CharField(read_only=True)

    class Meta:
        model = Project
        fields = ["id", "name", "color", "emoji", "display_emoji", "description", "subprojects", "created_at"]
