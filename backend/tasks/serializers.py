from rest_framework import serializers

from .models import CalendarEvent, Comment, RecurrenceRule, Status, Task


class RecurrenceRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurrenceRule
        fields = ["id", "freq", "interval", "anchor", "end_date", "count"]

    def validate(self, attrs):
        if attrs.get("end_date") and attrs.get("count"):
            raise serializers.ValidationError("Set at most one of end_date or count.")
        if attrs.get("interval", 1) < 1:
            raise serializers.ValidationError("interval must be >= 1.")
        return attrs


class TaskSerializer(serializers.ModelSerializer):
    recurrence = RecurrenceRuleSerializer(source="recurrence_rule", required=False, allow_null=True)
    project = serializers.IntegerField(source="project_id", read_only=True)
    comment_count = serializers.IntegerField(source="comments.count", read_only=True)

    class Meta:
        model = Task
        fields = [
            "id", "subproject", "project", "title", "details", "requirements",
            "assignees", "assignee_groups", "deadline", "timeline_start", "timeline_end",
            "status", "approval_state", "recurrence", "links", "monitor",
            "created_by", "created_at", "updated_at", "archived_at", "comment_count",
        ]
        # status has its own endpoint; approval_state/created_by/archived_at are server-controlled
        read_only_fields = ["status", "approval_state", "created_by", "archived_at"]

    def validate_links(self, value):
        if not isinstance(value, list) or not all(isinstance(u, str) for u in value):
            raise serializers.ValidationError("links must be a list of URL strings.")
        return value

    def _write_recurrence(self, instance, recurrence_data):
        if recurrence_data is None:
            if instance.recurrence_rule_id:
                instance.recurrence_rule.delete()
                instance.recurrence_rule = None
            return
        rule = instance.recurrence_rule or RecurrenceRule()
        for k, v in recurrence_data.items():
            setattr(rule, k, v)
        rule.save()
        instance.recurrence_rule = rule

    def create(self, validated_data):
        recurrence_data = validated_data.pop("recurrence_rule", None)
        assignees = validated_data.pop("assignees", [])
        assignee_groups = validated_data.pop("assignee_groups", [])
        task = Task(**validated_data)
        if recurrence_data is not None:
            rule = RecurrenceRule.objects.create(**recurrence_data)
            task.recurrence_rule = rule
        task.save()
        task.assignees.set(assignees)
        task.assignee_groups.set(assignee_groups)
        return task

    def update(self, instance, validated_data):
        has_recurrence = "recurrence_rule" in validated_data
        recurrence_data = validated_data.pop("recurrence_rule", None)
        assignees = validated_data.pop("assignees", None)
        assignee_groups = validated_data.pop("assignee_groups", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if has_recurrence:
            self._write_recurrence(instance, recurrence_data)
        instance.save()
        if assignees is not None:
            instance.assignees.set(assignees)
        if assignee_groups is not None:
            instance.assignee_groups.set(assignee_groups)
        return instance


class StatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Status
        fields = ["id", "key", "label", "color", "order", "is_complete", "is_initial"]
        extra_kwargs = {"key": {"required": False}}

    def validate(self, attrs):
        from django.utils.text import slugify
        if not attrs.get("key") and attrs.get("label"):
            attrs["key"] = slugify(attrs["label"])[:50] or "status"
        return attrs


class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = ["id", "date", "title", "yearly"]


class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ["id", "task", "author", "text", "created_at"]
        read_only_fields = ["author"]
