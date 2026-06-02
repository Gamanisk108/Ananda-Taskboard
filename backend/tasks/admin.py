from django.contrib import admin

from .models import Comment, RecurrenceRule, Subtask, Task, TaskOccurrence


@admin.register(Subtask)
class SubtaskAdmin(admin.ModelAdmin):
    list_display = ("title", "task", "is_done", "position")
    list_filter = ("is_done",)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "subproject", "status", "approval_state", "deadline")
    list_filter = ("status", "approval_state", "subproject__project")
    search_fields = ("title", "details")
    raw_id_fields = ("subproject", "recurrence_rule", "created_by")
    filter_horizontal = ("assignees",)


@admin.register(RecurrenceRule)
class RecurrenceRuleAdmin(admin.ModelAdmin):
    list_display = ("__str__", "freq", "interval", "end_date", "count")


@admin.register(TaskOccurrence)
class TaskOccurrenceAdmin(admin.ModelAdmin):
    list_display = ("task", "date", "status", "overridden")
    list_filter = ("status", "overridden")


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("task", "author", "created_at")
    search_fields = ("text",)
