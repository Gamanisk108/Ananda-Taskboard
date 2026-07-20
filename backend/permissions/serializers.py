from rest_framework import serializers

from .models import AccessGrant, Exclusion
from .org_scope import (
    group_org_id,
    project_org_id,
    require_org,
    require_users_in_org,
    subproject_org_id,
    task_org_id,
    tier_org_id,
)


def _exactly_one(*values):
    return sum(1 for v in values if v) == 1


class AccessGrantSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccessGrant
        fields = ["id", "user", "group", "tier", "subproject", "project", "level", "sees"]

    def validate(self, attrs):
        # exactly one target (user/group/tier), exactly one scope (subproject/project)
        # — mirrors the DB constraints so the API returns a clean 400, not a 500.
        def cur(field):
            return attrs.get(field, getattr(self.instance, field, None))

        if not _exactly_one(cur("user"), cur("group"), cur("tier")):
            raise serializers.ValidationError("Set exactly one of user, group, or tier.")
        if bool(cur("subproject")) == bool(cur("project")):
            raise serializers.ValidationError(
                "Set exactly one of subproject or project (whole-project grant)."
            )
        # Cross-org write guard (2026-07-19 security fix, critical): every one
        # of these fields is an unrestricted PrimaryKeyRelatedField, so without
        # this any org admin could mint a grant targeting another org's
        # sub-project/project/tier/group/user. self.context["org"] is set by
        # AccessGrantViewSet.get_serializer_context().
        org = self.context.get("org")
        require_org(org, cur("subproject"), subproject_org_id, "sub-project")
        require_org(org, cur("project"), project_org_id, "project")
        require_org(org, cur("tier"), tier_org_id, "tier")
        require_org(org, cur("group"), group_org_id, "group")
        if cur("user"):
            require_users_in_org(org, [cur("user")])
        return attrs


class ExclusionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exclusion
        fields = [
            "id", "user", "group", "tier",
            "excluded_user", "excluded_group", "excluded_project",
            "excluded_subproject", "excluded_task",
        ]

    def validate(self, attrs):
        def cur(field):
            return attrs.get(field, getattr(self.instance, field, None))

        if not _exactly_one(cur("user"), cur("group"), cur("tier")):
            raise serializers.ValidationError("Set exactly one subject: user, group, or tier.")
        targets = [
            cur("excluded_user"), cur("excluded_group"), cur("excluded_project"),
            cur("excluded_subproject"), cur("excluded_task"),
        ]
        if not _exactly_one(*targets):
            raise serializers.ValidationError(
                "Set exactly one excluded target: user, group, project, sub-project, or task."
            )
        # Cross-org write guard (2026-07-19 security fix, critical) — same class
        # of bug as AccessGrantSerializer above, for both the subject and the
        # excluded-target fields.
        org = self.context.get("org")
        require_org(org, cur("tier"), tier_org_id, "tier")
        require_org(org, cur("group"), group_org_id, "group")
        require_org(org, cur("excluded_project"), project_org_id, "project")
        require_org(org, cur("excluded_subproject"), subproject_org_id, "sub-project")
        require_org(org, cur("excluded_group"), group_org_id, "group")
        require_org(org, cur("excluded_task"), task_org_id, "task")
        for field in ("user", "excluded_user"):
            if cur(field):
                require_users_in_org(org, [cur(field)])
        return attrs
