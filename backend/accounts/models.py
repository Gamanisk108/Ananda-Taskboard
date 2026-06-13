"""
Accounts: a custom email-login User, and Group (named collections of users used
for bulk permission grants — distinct from django.contrib.auth.Group).
"""

import secrets

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
    # Personal UI theme (e.g. "light"/"dark"); blank = follow the app default.
    # Self-service via PATCH /api/me — distinct from admin-only app settings.
    theme = models.CharField(max_length=20, blank=True, default="")
    # Personal opt-out of the daily push. The app-wide push *schedule* stays
    # admin-controlled; this only governs whether THIS user receives one.
    daily_push_enabled = models.BooleanField(default=True)
    # Extra PWA-push notifications (free; web push, no app store). Deadline
    # reminders (a "due tomorrow" heads-up in the digest) default ON;
    # assignment-change pings default OFF (opt-in).
    deadline_reminders = models.BooleanField(default=True)
    assignment_changes = models.BooleanField(default=False)
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
    state = models.CharField(max_length=120, blank=True)  # state / province / region
    country = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(
        "User", null=True, blank=True, on_delete=models.SET_NULL, related_name="orgs_created"
    )
    # False until the creator verifies their email (self-serve signup gate).
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    # Holiday sets shown on this org's calendars (keys from tasks.holidays_feed).
    # Empty list → the app falls back to DEFAULT_SETS at read time.
    enabled_holiday_sets = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Membership(models.Model):
    """A user's standing within ONE organization — the unit of per-org permission:
    role (owner|admin|member) plus an optional tier. A user may hold many
    memberships, one per org they belong to.

    OWNER is the single top authority per org (seeded as the org's creator):
    an admin in every respect, but additionally cannot be demoted, deactivated,
    or removed by anyone else — only the owner can hand ownership to another
    member (which demotes the old owner to admin). Exactly one per org."""

    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
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
    def is_owner(self):
        return self.role == self.Role.OWNER

    @property
    def is_admin(self):
        """Owner is an admin in every respect, plus protections."""
        return self.role in (self.Role.ADMIN, self.Role.OWNER)

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
# "View Access" levels — how many tasks a member can SEE. This is now the member's
# single visibility control (set per member via their tier); the widest wins on
# conflict. Labels here are the user-facing View Access names.
SEES_OWN = "own"
SEES_SUBPROJECT = "subproject"
SEES_PROJECT = "project"
SEES_ORG = "org"
SEES_CHOICES = [
    (SEES_OWN, "Tasks Only"),               # only tasks assigned to them
    (SEES_SUBPROJECT, "Sub-Project Only"),  # all tasks in their sub-projects
    (SEES_PROJECT, "Full Project"),         # all tasks in their projects
    (SEES_ORG, "Organization"),             # all tasks across the whole org
]
# Higher = wider. Used so the most-permissive level wins on conflict.
SEES_RANK = {SEES_OWN: 1, SEES_SUBPROJECT: 2, SEES_PROJECT: 3, SEES_ORG: 4}


class Tier(models.Model):
    """A member's "View Access" level (Tasks Only / Sub-Project Only / Full Project
    / Organization). Internally still called Tier; the UI label is "View Access".

    `default_sees` IS the member's visibility breadth — applied live everywhere they
    can reach (see permissions/engine.py). A member assigned to a tier also inherits
    any access grants/exclusions that target the tier (editing it affects members
    immediately — no copy/re-apply step).
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


# The standard "View Access" set seeded for every organization. A member is
# assigned exactly one; it is their single visibility control (how many tasks they
# can see). WHERE they can act is still set via the Access tab. Order = increasing
# visibility, which is also the dropdown order.
DEFAULT_TIERS = [
    ("Tasks Only", SEES_OWN),               # only tasks assigned to them
    ("Sub-Project Only", SEES_SUBPROJECT),  # all tasks in their sub-projects
    ("Full Project", SEES_PROJECT),         # all tasks in their projects
    ("Organization", SEES_ORG),             # all tasks across the whole org
]


def ensure_default_tiers(org):
    """Idempotently seed the standard tiers for an organization. Safe to call on
    org creation and from data migrations / seeds — get_or_create keeps it a no-op
    once the tiers exist (and never clobbers an admin-renamed tier of the same name)."""
    for name, sees in DEFAULT_TIERS:
        Tier.objects.get_or_create(
            organization=org, name=name, defaults={"default_sees": sees}
        )


def _invite_token():
    return secrets.token_urlsafe(32)


class Invitation(models.Model):
    """A pending invite for an email to join ONE org at a role + tier. The emailed
    token is the secret that authorizes acceptance; accepting creates the
    Membership (and the User, if the invitee has no account yet)."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REVOKED = "revoked", "Revoked"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    role = models.CharField(max_length=10, choices=Membership.Role.choices, default=Membership.Role.MEMBER)
    tier = models.ForeignKey(Tier, null=True, blank=True, on_delete=models.SET_NULL, related_name="invitations")
    # Optional initial access granted on acceptance so a new member lands with
    # something to see (no limbo). List of
    # {"scope": "subproject"|"project", "id": <int>, "level": "member"|"viewer"}.
    access = models.JSONField(default=list, blank=True)
    token = models.CharField(max_length=64, default=_invite_token, db_index=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    invited_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="sent_invitations")
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "email"],
                condition=models.Q(status="pending"),
                name="one_pending_invite_per_org_email",
            ),
        ]

    def __str__(self):
        return f"{self.email} → {self.organization} [{self.role}/{self.status}]"

    @property
    def is_expired(self):
        from datetime import timedelta

        from django.conf import settings
        from django.utils import timezone

        return timezone.now() > self.created_at + timedelta(days=getattr(settings, "INVITE_TIMEOUT_DAYS", 14))
