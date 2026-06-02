"""
Accounts: a custom email-login User, and Group (named collections of users used
for bulk permission grants — distinct from django.contrib.auth.Group).
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


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
