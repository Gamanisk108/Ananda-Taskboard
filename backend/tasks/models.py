"""Tasks, recurrence rules, occurrences, and comments.

A Task lives under exactly one Sub-project (which resolves its Project). Member
actions may require Admin approval (unless the sub-project is trusted). Recurrence
is optional; when set, occurrences are generated lazily over a queried window by
the recurrence engine (step 6), each occurrence carrying its own status.
"""

from django.conf import settings
from django.db import models

from projects.models import SubProject
from softdelete import SoftDeleteModel


class Status(models.Model):
    """A universal task status (Kanban column) shared by ALL projects. Admin-
    editable: rename/recolor/reorder/add/remove. The statuses here are the allowed
    values of Task.status (stored by `key`). One is flagged `is_complete` (=
    "Done") which drives auto-archiving and hiding from calendars."""

    key = models.SlugField(unique=True)          # stable id stored on Task.status
    label = models.CharField(max_length=60)
    color = models.CharField(max_length=9, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_complete = models.BooleanField(default=False)  # the "Done/Complete" state
    is_initial = models.BooleanField(default=False)   # default for brand-new tasks

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.label


def complete_status_keys():
    keys = list(Status.objects.filter(is_complete=True).values_list("key", flat=True))
    return keys or ["done"]  # fallback to seeded default


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
    # WEEKLY only: fire on these weekdays each active week (CSV, Mon=0..Sun=6).
    # Empty = the anchor's own weekday (classic single-day weekly).
    weekdays = models.CharField(max_length=20, blank=True, default="")

    def weekday_list(self):
        return [int(x) for x in self.weekdays.split(",") if x != ""]

    def __str__(self):
        every = f"every {self.interval} " if self.interval != 1 else "every "
        return f"{every}{self.freq} from {self.anchor}"


class Task(SoftDeleteModel):
    class Status(models.TextChoices):
        TODO = "todo", "To Do"
        IN_PROGRESS = "in_progress", "In Progress"
        DELAYED = "delayed", "Delayed"
        REVIEW = "review", "Ready for Review"
        DONE = "done", "Done"

    class Approval(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    class Priority(models.IntegerChoices):
        LOWEST = 1, "Lowest"
        LOW = 2, "Low"
        MEDIUM = 3, "Medium"
        HIGH = 4, "High"
        HIGHEST = 5, "Highest"

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
    priority = models.PositiveSmallIntegerField(choices=Priority.choices, default=Priority.MEDIUM)
    # Optional time-of-day (e.g. a class 1pm-4pm). "Timed" when both are set;
    # both-or-neither is enforced by the serializer. Applies to every occurrence
    # of a recurring task.
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
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
    # Completed tasks auto-archive after a few days: hidden from board/calendar but
    # recoverable from the Archive (distinct from Trash/soft-delete).
    archived_at = models.DateTimeField(null=True, blank=True, db_index=True)
    # When ON, admins are notified whenever this task is moved (status changed). Default off.
    monitor = models.BooleanField(default=False)
    # When ON, a one-off task auto-marks Done the morning after its deadline passes
    # (for mundane tasks you don't want to tick off manually). Default off.
    auto_complete = models.BooleanField(default=False)

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


class Subtask(models.Model):
    """A checklist item under a Task, with its own status (same status keys as
    tasks). Simple and ordered — not a full task (no assignees/dates)."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="subtasks")
    title = models.CharField(max_length=300)
    status = models.CharField(max_length=12, default="todo")  # a Status.key
    order = models.PositiveIntegerField(default=0)
    # Optional owner of this subtask. The assignee may edit THIS subtask even if
    # they can't otherwise edit the parent task (as long as they can see it).
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="assigned_subtasks",
    )

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.title} [{self.status}]"


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


class CalendarEvent(models.Model):
    """A dated note shown in the Weekly/Monthly calendars (birthdays, retreats,
    class series). Not a task. Exactly one `kind`:
    - single    : one day (`date`)
    - yearly    : repeats annually on `date` (e.g. birthdays)
    - range     : a continuous span from `date` to `end_date` (inclusive)
    - repeating : weekly on `weekdays`, every `interval` weeks from `date`,
                  stopping after `count` weeks OR on `end_date` (or never).
    """

    class Kind(models.TextChoices):
        SINGLE = "single", "Single date"
        YEARLY = "yearly", "Yearly"
        RANGE = "range", "Date range"
        REPEATING = "repeating", "Repeating"

    # The owning tenant. Nullable transitional (data migration backfills existing
    # rows); the app sets it on create, so new events are never null.
    organization = models.ForeignKey(
        "accounts.Organization", null=True, blank=True, on_delete=models.CASCADE, related_name="events"
    )
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.SINGLE)
    date = models.DateField()                 # single/yearly date, range start, or series anchor
    end_date = models.DateField(null=True, blank=True)   # range end (incl) or repeat "until"
    weekdays = models.CharField(max_length=20, blank=True, default="")  # repeating: CSV, Mon=0..Sun=6
    interval = models.PositiveIntegerField(default=1)    # repeating: every N weeks
    count = models.PositiveIntegerField(null=True, blank=True)  # repeating: stop after N weeks
    title = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date"]

    def weekday_list(self):
        """Parsed weekdays as ints (Mon=0..Sun=6); [] when not repeating."""
        return [int(x) for x in self.weekdays.split(",") if x != ""]

    def __str__(self):
        return f"{self.title} ({self.kind} @ {self.date})"


class HistoryDay(models.Model):
    """A point-in-time snapshot of which tasks were live on a given date and who
    was assigned then — so you can look back accurately even after reassignments.
    One row per date; captured by the daily cron, pruned after ~12 months."""

    date = models.DateField(unique=True)
    instances = models.JSONField(default=list)  # denormalized task rows for that day
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"history {self.date} ({len(self.instances)} items)"


class RestorePoint(models.Model):
    """A full-board snapshot (projects, sub-projects, tasks, events, groups,
    grants) an admin can restore to. Auto-saves are pruned (keep last N); manual
    saves are kept permanently."""

    label = models.CharField(max_length=200)
    auto = models.BooleanField(default=False)
    data = models.JSONField(default=list)   # serialized rows in dependency order
    stats = models.JSONField(default=dict)  # {projects, subprojects, tasks, ...}
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{'auto' if self.auto else 'manual'}: {self.label}"


class Comment(models.Model):
    """A comment on a Task. Media is referenced by URL (no file storage)."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="comments")
    text = models.TextField()
    mentions = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="comment_mentions")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"comment by {self.author} on {self.task_id}"
