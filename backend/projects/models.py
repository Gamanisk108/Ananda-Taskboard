"""Projects and Sub-projects.

A Project owns one or more Sub-projects. The Sub-project is the unit of access
(permissions are granted here, step 4). Every Project gets a default 'General'
sub-project so a Task ALWAYS lives under a sub-project (uniform data model); the
frontend hides the sub-project layer when only the default exists.
"""

from django.db import models

# Curated coding palette (mirrors docs/design-system.md). New projects/sub-projects
# auto-pick the next unused color; on exhaustion we cycle (frontend disambiguates
# collisions with a numeric suffix badge — see §12 color-exhaustion).
PALETTE = [
    "#C8762F", "#2F7D74", "#4F7A3C", "#7A5AA6", "#B4452F", "#2563A8",
    "#B7791F", "#6B7280", "#A23E6E", "#3F8E8E", "#8A6D3B", "#5B6CB8",
]

DEFAULT_SUBPROJECT_NAME = "General"


def _next_color(used):
    """First palette color not in `used`; if all used, cycle by count."""
    for c in PALETTE:
        if c not in used:
            return c
    return PALETTE[len(used) % len(PALETTE)]


class Project(models.Model):
    name = models.CharField(max_length=160)
    color = models.CharField(max_length=9, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.color:
            used = set(Project.objects.exclude(pk=self.pk).values_list("color", flat=True))
            self.color = _next_color(used)
        super().save(*args, **kwargs)


class SubProject(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="subprojects")
    name = models.CharField(max_length=160)
    color = models.CharField(max_length=9, blank=True)
    description = models.TextField(blank=True)
    # When ON, Member-created/edited tasks in this sub-project go live immediately
    # instead of entering Pending Approval (keeps admins from drowning in reviews).
    members_post_without_approval = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["project__name", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["project"],
                condition=models.Q(is_default=True),
                name="one_default_subproject_per_project",
            )
        ]

    def __str__(self):
        return f"{self.project.name} / {self.name}"

    def save(self, *args, **kwargs):
        if not self.color:
            used = set(
                SubProject.objects.filter(project=self.project)
                .exclude(pk=self.pk)
                .values_list("color", flat=True)
            )
            # Seed sub-project palette offset by the project color for variety.
            self.color = _next_color(used | {self.project.color})
        super().save(*args, **kwargs)
