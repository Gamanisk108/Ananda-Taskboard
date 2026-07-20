from rest_framework import serializers

from permissions.org_scope import project_org_id, require_org

from .models import Project, SubProject


class SubProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubProject
        fields = [
            "id", "project", "name", "color", "description",
            "members_post_without_approval", "is_default", "created_at",
        ]
        read_only_fields = ["is_default", "created_at"]

    def validate(self, attrs):
        # `project` is an unrestricted PrimaryKeyRelatedField over the whole
        # Project table, so without this an org admin could reparent a
        # sub-project (and all its tasks/comments/attachments) into — or
        # create one under — another organization's project (2026-07-19
        # security fix, critical). self.context["org"] is set by
        # SubProjectViewSet.get_serializer_context().
        project = attrs.get("project", getattr(self.instance, "project", None))
        require_org(self.context.get("org"), project, project_org_id, "project")
        return attrs


class ProjectSerializer(serializers.ModelSerializer):
    subprojects = SubProjectSerializer(many=True, read_only=True)
    display_emoji = serializers.CharField(read_only=True)

    class Meta:
        model = Project
        fields = ["id", "name", "color", "emoji", "display_emoji", "description", "subprojects", "created_at"]
