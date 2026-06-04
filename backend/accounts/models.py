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
        return self.role == self.Role.ADMIN


class Group(models.Model):
    """A named collection of users (e.g. 'Alliance', 'Seva Volunteers') used to
    grant access in bulk. A user may belong to many. Distinct from auth.Group."""

    name = models.CharField(max_length=120, unique=True)
    members = models.ManyToManyField(User, related_name="member_groups", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

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

    name = models.CharField(max_length=120, unique=True)
    default_sees = models.CharField(max_length=12, choices=SEES_CHOICES, default=SEES_SUBPROJECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
