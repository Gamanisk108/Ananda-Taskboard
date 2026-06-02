"""Tasks, recurrence rules, occurrences, and comments.

A Task lives under exactly one Sub-project (which resolves its Project). Member
actions may require Admin approval (unless the sub-project is trusted). Recurrence
is optional; when set, occurrences are generated lazily over a queried window by
the recurrence engine (step 6), each occurrence carrying its own status.
"""

from django.conf import settings
from django.db import models

from projects.models import SubProject


class RecurrenceRule(models.Model):
    class Freq(models.TextChoices):
        DAILY = "daily", "Daily"
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"
        YEARLY = "yearly", "Yearly"

    freq = models.CharField(max_length=10, choices=Freq.choices)
    interval = models.PositiveIntegerField(default=1)  # every N freq units
    anchor = models.DateField()                        # first occurrence date
    # Optional end: indefinite if both null; else stops at end_date OR after count.
    end_date = models.DateField(null=True, blank=True)
    count = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        every = f"every {self.interval} " if self.interval != 1 else "every "
        return f"{every}{self.freq} from {self.anchor}"


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "To Do"
        IN_PROGRESS = "in_progress", "In Progress"
        DONE = "done", "Done"
        DELAYED = "delayed", "Delayed"

    class Approval(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    subproject = models.ForeignKey(SubProject, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=300)
    details = models.TextField(blank=True)
    requirements = models.TextField(blank=True)
    assignees = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="assigned_tasks")
    # Phase-2: a task can also be assigned to whole Groups (every member counts as
    # assigned for the daily push and "their tasks" filtering).
    assignee_groups = models.ManyToManyField("accounts.Group", blank=True, related_name="assigned_tasks")
    deadline = models.DateField(null=True, blank=True)
    timeline_start = models.DateField(null=True, blank=True)
    timeline_end = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.TODO)
    approval_state = models.CharField(max_length=10, choices=Approval.choices, default=Approval.APPROVED)
    recurrence_rule = models.OneToOneField(
        RecurrenceRule, null=True, blank=True, on_delete=models.SET_NULL, related_name="task"
    )
    links = models.JSONField(default=list, blank=True)  # list of URL strings
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="created_tasks"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["deadline", "title"]

    def __str__(self):
        return self.title

    @property
    def project_id(self):
        return self.subproject.project_id

    @property
    def is_recurring(self):
        return self.recurrence_rule_id is not None


class TaskOccurrence(models.Model):
    """A concrete dated instance of a recurring Task. Status is independent per
    occurrence. Materialized by the recurrence engine (step 6)."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="occurrences")
    date = models.DateField()
    status = models.CharField(max_length=12, choices=Task.Status.choices, default=Task.Status.TODO)
    overridden = models.BooleanField(default=False)

    class Meta:
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(fields=["task", "date"], name="one_occurrence_per_task_date")
        ]

    def __str__(self):
        return f"{self.task.title} @ {self.date}"


class Subtask(models.Model):
    """A checklist item under a Task (Phase 2). Nesting is capped here — subtasks
    have no children."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="subtasks")
    title = models.CharField(max_length=300)
    is_done = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "created_at"]

    def __str__(self):
        return self.title


class Comment(models.Model):
    """A comment on a Task. Media is referenced by URL (no file storage)."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="comments")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"comment by {self.author} on {self.task_id}"
