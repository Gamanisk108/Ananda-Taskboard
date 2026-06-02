"""Access grants — the visibility gate.

A grant links a target (a User XOR a Group) to a scope (a SubProject XOR a whole
Project) at a level (member | viewer). Whole-project grants cover all current AND
future sub-projects because effective access is computed live from grants
(permissions/engine.py), never materialized.
"""

from django.core.exceptions import ValidationError
from django.db import models

from accounts.models import Group, User
from projects.models import Project, SubProject

LEVEL_VIEWER = "viewer"
LEVEL_MEMBER = "member"
# Higher number = more permissive. Used to reduce conflicts (most-permissive wins).
LEVEL_RANK = {LEVEL_VIEWER: 1, LEVEL_MEMBER: 2}


class AccessGrant(models.Model):
    class Level(models.TextChoices):
        VIEWER = LEVEL_VIEWER, "Viewer"
        MEMBER = LEVEL_MEMBER, "Member"

    # target: exactly one of user / group
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="grants")
    group = models.ForeignKey(Group, null=True, blank=True, on_delete=models.CASCADE, related_name="grants")
    # scope: exactly one of subproject / project (project = whole-project grant)
    subproject = models.ForeignKey(SubProject, null=True, blank=True, on_delete=models.CASCADE, related_name="grants")
    project = models.ForeignKey(Project, null=True, blank=True, on_delete=models.CASCADE, related_name="grants")

    level = models.CharField(max_length=10, choices=Level.choices, default=Level.MEMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                name="grant_target_exactly_one",
                condition=(
                    models.Q(user__isnull=False, group__isnull=True)
                    | models.Q(user__isnull=True, group__isnull=False)
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
        if bool(self.user) == bool(self.group):
            raise ValidationError("Set exactly one of user or group.")
        if bool(self.subproject) == bool(self.project):
            raise ValidationError("Set exactly one of subproject or project (whole-project grant).")

    def __str__(self):
        who = self.user or self.group
        what = self.subproject or f"{self.project} (whole)"
        return f"{who} → {what} [{self.level}]"
