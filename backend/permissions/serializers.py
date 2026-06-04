from rest_framework import serializers

from .models import AccessGrant, Exclusion


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
        return attrs
