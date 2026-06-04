"""Access grants + exclusions — the visibility gate.

A grant links a target (a User XOR Group XOR Tier) to a scope (a SubProject XOR a
whole Project) at a level (member | viewer) with a "sees" breadth (own | subproject
| project). Whole-project grants cover all current AND future sub-projects because
effective access is computed live from grants (permissions/engine.py), never
materialized.

An Exclusion subtracts visibility: it links a subject (User XOR Group XOR Tier) to
one excluded target (a User, Group, Project, SubProject, or Task). A deny always
wins, even over a task the member is assigned to (deny > assignment > allow).
"""

from django.core.exceptions import ValidationError
from django.db import models

from accounts.models import SEES_CHOICES, SEES_SUBPROJECT, Group, Tier, User
from projects.models import Project, SubProject

LEVEL_VIEWER = "viewer"
LEVEL_MEMBER = "member"
# Higher number = more permissive. Used to reduce conflicts (most-permissive wins).
LEVEL_RANK = {LEVEL_VIEWER: 1, LEVEL_MEMBER: 2}


def _exactly_one(*values):
    return sum(1 for v in values if v) == 1


class AccessGrant(models.Model):
    class Level(models.TextChoices):
        VIEWER = LEVEL_VIEWER, "Viewer"
        MEMBER = LEVEL_MEMBER, "Member"

    # target: exactly one of user / group / tier
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="grants")
    group = models.ForeignKey(Group, null=True, blank=True, on_delete=models.CASCADE, related_name="grants")
    tier = models.ForeignKey(Tier, null=True, blank=True, on_delete=models.CASCADE, related_name="grants")
    # scope: exactly one of subproject / project (project = whole-project grant)
    subproject = models.ForeignKey(SubProject, null=True, blank=True, on_delete=models.CASCADE, related_name="grants")
    project = models.ForeignKey(Project, null=True, blank=True, on_delete=models.CASCADE, related_name="grants")

    level = models.CharField(max_length=10, choices=Level.choices, default=Level.MEMBER)
    # Which tasks in scope the holder may SEE (orthogonal to the edit level).
    sees = models.CharField(max_length=12, choices=SEES_CHOICES, default=SEES_SUBPROJECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                name="grant_target_exactly_one",
                condition=(
                    models.Q(user__isnull=False, group__isnull=True, tier__isnull=True)
                    | models.Q(user__isnull=True, group__isnull=False, tier__isnull=True)
                    | models.Q(user__isnull=True, group__isnull=True, tier__isnull=False)
                ),
            ),
            models.CheckConstraint(
                name="grant_scope_exactly_one",
                condition=(
                    models.Q(subproject__isnull=False, project__isnull=True)
                    | models.Q(subproject__isnull=True, project__isnull=False)
                ),
            ),
        ]

    def clean(self):
        if not _exactly_one(self.user, self.group, self.tier):
            raise ValidationError("Set exactly one of user, group, or tier.")
        if bool(self.subproject) == bool(self.project):
            raise ValidationError("Set exactly one of subproject or project (whole-project grant).")

    def __str__(self):
        who = self.user or self.group or self.tier
        what = self.subproject or f"{self.project} (whole)"
        return f"{who} → {what} [{self.level}/{self.sees}]"


class Exclusion(models.Model):
    """A deny rule: hide a specific thing from a subject (user / group / tier).

    Exactly one subject and exactly one excluded target. Effective for a user =
    exclusions targeting them directly, any of their groups, or their tier.
    """

    # subject: exactly one of user / group / tier
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="exclusions")
    group = models.ForeignKey(Group, null=True, blank=True, on_delete=models.CASCADE, related_name="exclusions")
    tier = models.ForeignKey(Tier, null=True, blank=True, on_delete=models.CASCADE, related_name="exclusions")

    # excluded target: exactly one of these
    excluded_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="hidden_by")
    excluded_group = models.ForeignKey(Group, null=True, blank=True, on_delete=models.CASCADE, related_name="hidden_by")
    excluded_project = models.ForeignKey(Project, null=True, blank=True, on_delete=models.CASCADE, related_name="hidden_by")
    excluded_subproject = models.ForeignKey(SubProject, null=True, blank=True, on_delete=models.CASCADE, related_name="hidden_by")
    excluded_task = models.ForeignKey("tasks.Task", null=True, blank=True, on_delete=models.CASCADE, related_name="hidden_by")

    created_at = models.DateTimeField(auto_now_add=True)

    def _targets(self):
        return (
            self.excluded_user, self.excluded_group, self.excluded_project,
            self.excluded_subproject, self.excluded_task,
        )

    def clean(self):
        if not _exactly_one(self.user, self.group, self.tier):
            raise ValidationError("Set exactly one subject: user, group, or tier.")
        if not _exactly_one(*self._targets()):
            raise ValidationError(
                "Set exactly one excluded target: user, group, project, sub-project, or task."
            )

    def __str__(self):
        who = self.user or self.group or self.tier
        what = next((t for t in self._targets() if t), "?")
        return f"{who} ⊘ {what}"


class AuditLog(models.Model):
    """Append-only trail of permission/visibility changes (grants, exclusions,
    tiers, role/tier assignments) — who did what, when. Read-only via the API."""

    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="audit_actions")
    action = models.CharField(max_length=40)   # e.g. "grant.create", "tier.delete", "user.role"
    summary = models.CharField(max_length=300)  # human-readable description
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action}: {self.summary}"


def audit(actor, action, summary):
    """Record one audit entry (best-effort; never breaks the triggering action)."""
    try:
        AuditLog.objects.create(actor=actor if getattr(actor, "is_authenticated", False) else None,
                                action=action, summary=summary[:300])
    except Exception:
        pass
