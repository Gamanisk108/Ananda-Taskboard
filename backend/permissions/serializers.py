from rest_framework import serializers

from .models import AccessGrant


class AccessGrantSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccessGrant
        fields = ["id", "user", "group", "subproject", "project", "level"]

    def validate(self, attrs):
        # exactly one target, exactly one scope (mirrors the DB constraints so the
        # API returns a clean 400 instead of an IntegrityError 500)
        data = {**getattr(self, "instance", None).__dict__, **attrs} if self.instance else attrs
        user = attrs.get("user", getattr(self.instance, "user", None))
        group = attrs.get("group", getattr(self.instance, "group", None))
        subproject = attrs.get("subproject", getattr(self.instance, "subproject", None))
        project = attrs.get("project", getattr(self.instance, "project", None))

        if bool(user) == bool(group):
            raise serializers.ValidationError("Set exactly one of user or group.")
        if bool(subproject) == bool(project):
            raise serializers.ValidationError(
                "Set exactly one of subproject or project (whole-project grant)."
            )
        return attrs
