"""
Accounts: a custom email-login User, and Group (named collections of users used
for bulk permission grants — distinct from django.contrib.auth.Group).
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

# UI languages a user can pick (interface translation). "" = auto-detect/English.
# Keep in sync with the frontend picker + locale catalogs (frontend/src/locales).
SUPPORTED_LANGUAGES = ["en", "it", "es", "fr", "de", "pt", "zh", "hi", "bn", "ta", "te", "mr", "gu"]


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, name, password, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, name=name or "", **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, name="", password=None, **extra):
        extra.setdefault("role", User.Role.MEMBER)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, name, password, **extra)

    def create_superuser(self, email, name="", password=None, **extra):
        extra.update(role=User.Role.ADMIN, is_staff=True, is_superuser=True, is_active=True)
        return self._create(email, name, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Email-login user. Role is global: ADMIN sees/manages everything;
    MEMBER's capabilities come from per-sub-project access grants."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=200, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)  # Django admin access
    # Preferred UI language (interface translation). Blank = auto-detect/English.
    language = models.CharField(max_length=10, blank=True, default="")
    # Optional permission tier: a reusable template a member inherits grants +
    # default visibility from (admins ignore tiers — they see everything).
    tier = models.ForeignKey(
        "Tier", null=True, blank=True, on_delete=models.SET_NULL, related_name="users"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Guard so the daily push fires at most once per local day per user even if
    # the cron triggers more than once.
    last_daily_push = models.DateField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        ordering = ["name", "email"]

    def __str__(self):
        return self.name or self.email

    @property
    def is_admin(self):
        """DEPRECATED for multi-tenancy: global admin no longer drives access.
        Use permissions.engine.is_org_admin(user, org). Kept only so legacy code
        and the data migration can still read the pre-tenancy role."""
        return self.role == self.Role.ADMIN


class Organization(models.Model):
    """A tenant: one Ananda center/team. Every Project, Membership, Group, and
    Tier belongs to exactly one org; orgs are fully isolated from one another."""

    name = models.CharField(max_length=200)
    city = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(
        "User", null=True, blank=True, on_delete=models.SET_NULL, related_name="orgs_created"
    )
    # False until the creator verifies their email (self-serve signup gate).
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Membership(models.Model):
    """A user's standing within ONE organization — the unit of per-org permission:
    role (admin|member) plus an optional tier. A user may hold many memberships,
    one per org they belong to."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    user = models.ForeignKey("User", on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(
        "Organization", on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    tier = models.ForeignKey(
        "Tier", null=True, blank=True, on_delete=models.SET_NULL, related_name="memberships"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["organization__name", "user__name"]
        constraints = [
            models.UniqueConstraint(fields=["user", "organization"], name="one_membership_per_user_org"),
        ]

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    def __str__(self):
        return f"{self.user} @ {self.organization} [{self.role}]"


class Group(models.Model):
    """A named collection of users (e.g. 'Alliance', 'Seva Volunteers') used to
    grant access in bulk, scoped to one org. A user may belong to many. Distinct
    from auth.Group."""

    # Nullable transitional: the data migration backfills every existing row, and
    # all app code sets it on create. New orgs never produce a null.
    organization = models.ForeignKey(
        "Organization", null=True, blank=True, on_delete=models.CASCADE, related_name="groups"
    )
    name = models.CharField(max_length=120)
    members = models.ManyToManyField(User, related_name="member_groups", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "name"], name="uniq_group_name_per_org"),
        ]

    def __str__(self):
        return self.name


# ── Task-visibility "Sees" scope ───────────────────────────────────────────────
# How much of an accessible scope a grant lets the holder SEE (orthogonal to the
# member/viewer edit level). Lives here (no app deps) so both Tier and the
# permissions app's AccessGrant can share it without a circular import.
SEES_OWN = "own"
SEES_SUBPROJECT = "subproject"
SEES_PROJECT = "project"
SEES_CHOICES = [
    (SEES_OWN, "Own tasks only"),
    (SEES_SUBPROJECT, "All tasks in the sub-project"),
    (SEES_PROJECT, "All tasks in the project"),
]
# Higher = wider. Used so the most-permissive grant wins on conflict.
SEES_RANK = {SEES_OWN: 1, SEES_SUBPROJECT: 2, SEES_PROJECT: 3}


class Tier(models.Model):
    """A reusable permission template (e.g. 'Volunteer', 'Coordinator', 'Lead').

    A member assigned to a tier inherits that tier's access grants + exclusions
    LIVE (editing a tier instantly affects its members — no copy/re-apply step).
    `default_sees` is just the visibility pre-filled when adding the tier's grants.
    """

    organization = models.ForeignKey(
        "Organization", null=True, blank=True, on_delete=models.CASCADE, related_name="tiers"
    )
    name = models.CharField(max_length=120)
    default_sees = models.CharField(max_length=12, choices=SEES_CHOICES, default=SEES_SUBPROJECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "name"], name="uniq_tier_name_per_org"),
        ]

    def __str__(self):
        return self.name


# The standard tier set seeded for every organization. The tier-customization UI
# was removed, so this fixed set is what admins assign members to (access per tier
# is still granted via the Access tab). Order = increasing visibility.
DEFAULT_TIERS = [
    ("Volunteer", SEES_OWN),           # own tasks only
    ("Coordinator", SEES_SUBPROJECT),  # all tasks in the sub-project
    ("Lead", SEES_PROJECT),            # all tasks in the project
]


def ensure_default_tiers(org):
    """Idempotently seed the standard tiers for an organization. Safe to call on
    org creation and from data migrations / seeds — get_or_create keeps it a no-op
    once the tiers exist (and never clobbers an admin-renamed tier of the same name)."""
    for name, sees in DEFAULT_TIERS:
        Tier.objects.get_or_create(
            organization=org, name=name, defaults={"default_sees": sees}
        )
