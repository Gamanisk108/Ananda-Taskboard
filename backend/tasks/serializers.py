from rest_framework import serializers

from .models import CalendarEvent, Comment, RecurrenceRule, Status, Subtask, Task


class WeekdaysField(serializers.Field):
    """JSON list of ints (Mon=0..Sun=6) <-> CSV string stored on the model."""

    def to_representation(self, value):
        return [int(x) for x in value.split(",") if x != ""] if value else []

    def to_internal_value(self, data):
        if not isinstance(data, list) or not all(isinstance(x, int) and 0 <= x <= 6 for x in data):
            raise serializers.ValidationError("weekdays must be a list of ints 0..6 (Mon..Sun).")
        return ",".join(str(x) for x in sorted(set(data)))


class RecurrenceRuleSerializer(serializers.ModelSerializer):
    weekdays = WeekdaysField(required=False)

    class Meta:
        model = RecurrenceRule
        fields = ["id", "freq", "interval", "anchor", "end_date", "count", "weekdays"]

    def validate(self, attrs):
        if attrs.get("end_date") and attrs.get("count"):
            raise serializers.ValidationError("Set at most one of end_date or count.")
        if attrs.get("interval", 1) < 1:
            raise serializers.ValidationError("interval must be >= 1.")
        if attrs.get("weekdays") and attrs.get("freq", "weekly") != "weekly":
            raise serializers.ValidationError("weekdays apply only to weekly recurrence.")
        return attrs


class SubtaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subtask
        fields = [
            "id", "task", "title", "status", "order", "priority",
            "details", "requirements", "timeline_start", "deadline",
            "start_time", "end_time", "assignees", "assignee_groups",
        ]

    def validate(self, attrs):
        # Time-of-day is both-or-neither, with end strictly after start (same as Task).
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if bool(start) != bool(end):
            raise serializers.ValidationError("Set both a start time and an end time, or neither.")
        if start and end and end <= start:
            raise serializers.ValidationError("End time must be after the start time.")
        return attrs


class TaskSerializer(serializers.ModelSerializer):
    recurrence = RecurrenceRuleSerializer(source="recurrence_rule", required=False, allow_null=True)
    project = serializers.IntegerField(source="project_id", read_only=True)
    comment_count = serializers.SerializerMethodField()
    subtask_counts = serializers.SerializerMethodField()

    def get_comment_count(self, obj):
        # Uses the list queryset's annotation when present (one query for all
        # tasks); falls back to a per-object count for un-annotated callers.
        cc = getattr(obj, "comment_count_anno", None)
        return cc if cc is not None else obj.comments.count()

    def get_subtask_counts(self, obj):
        """{status_key: count} over the task's subtasks (only non-zero)."""
        counts = {}
        for s in obj.subtasks.all():
            counts[s.status] = counts.get(s.status, 0) + 1
        return counts

    class Meta:
        model = Task
        fields = [
            "id", "subproject", "project", "title", "details", "requirements",
            "assignees", "assignee_groups", "deadline", "timeline_start", "timeline_end",
            "start_time", "end_time", "priority",
            "status", "approval_state", "recurrence", "links", "monitor", "auto_complete",
            "created_by", "created_at", "updated_at", "archived_at", "comment_count",
            "subtask_counts",
        ]
        # status has its own endpoint; approval_state/created_by/archived_at are server-controlled
        read_only_fields = ["status", "approval_state", "created_by", "archived_at"]

    def validate_links(self, value):
        if not isinstance(value, list) or not all(isinstance(u, str) for u in value):
            raise serializers.ValidationError("links must be a list of URL strings.")
        return value

    def validate(self, attrs):
        # Time-of-day is both-or-neither, with end strictly after start.
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if bool(start) != bool(end):
            raise serializers.ValidationError("Set both a start time and an end time, or neither.")
        if start and end and end <= start:
            raise serializers.ValidationError("End time must be after the start time.")
        return attrs

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
        # DN9: honor an initial status chosen at creation. `status` is read-only
        # for updates (those go through the dedicated /status endpoint with its
        # side effects), but a valid initial key may be set when the task is born.
        initial_status = (self.initial_data or {}).get("status")
        if initial_status and Status.objects.filter(key=initial_status).exists():
            task.status = initial_status
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
    weekdays = WeekdaysField(required=False)

    class Meta:
        model = CalendarEvent
        fields = ["id", "kind", "date", "end_date", "weekdays", "interval", "count", "title"]

    def validate(self, attrs):
        # Merge against the existing instance so PATCH validates the full picture.
        kind = attrs.get("kind", getattr(self.instance, "kind", "single"))
        date = attrs.get("date", getattr(self.instance, "date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        weekdays = attrs.get("weekdays", getattr(self.instance, "weekdays", ""))
        count = attrs.get("count", getattr(self.instance, "count", None))
        interval = attrs.get("interval", getattr(self.instance, "interval", 1))

        if kind == "range":
            if not end_date:
                raise serializers.ValidationError("A date range needs an end date.")
            if date and end_date < date:
                raise serializers.ValidationError("End date must be on or after the start date.")
        elif kind == "repeating":
            if not weekdays:
                raise serializers.ValidationError("Pick at least one weekday to repeat on.")
            if end_date and count:
                raise serializers.ValidationError("Set at most one of: number of weeks, or until-date.")
            if date and end_date and end_date < date:
                raise serializers.ValidationError("Until-date must be on or after the start date.")
            if interval is not None and interval < 1:
                raise serializers.ValidationError("Interval (every N weeks) must be >= 1.")
        return attrs


class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ["id", "task", "author", "text", "mentions", "created_at"]
        read_only_fields = ["author", "mentions", "task"]
