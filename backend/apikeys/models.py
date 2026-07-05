"""API keys — a bearer token that lets an external agent (Claude, a script, an
MCP server, …) call the Taskboard API on behalf of an organization, WITHOUT a
password or an interactive login.

Security model (see .discovery/api-keys-build.md):
- The raw secret is shown exactly ONCE, at creation. Only a SHA-256 hash is
  stored — a leaked database never yields a usable key. (A fast hash is correct
  here: the token is 256 bits of entropy, so bcrypt's slowness/72-byte cap buys
  nothing over SHA-256.)
- Every key is bound to ONE organization. Requests authenticated by a key take
  their org from the KEY, never from an `X-Org-Id` header — so a key for org A
  can never be pointed at org B.
- A key acts AS its creator: the existing permission engine gates all
  visibility/edit rights on `created_by` + the key's org, so a key can never
  exceed the access of the admin who minted it.
- Scope is a coarse read/read-write gate enforced at the authentication layer
  (see authentication.py) so it holds regardless of any per-view permissions.
"""

import hashlib
import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone

# All keys share this human-recognizable prefix (Ananda TaskBoard). Lets a leaked
# key be spotted in logs/secret-scanners and distinguishes an API key from a JWT.
KEY_PREFIX = "atb_"
# Chars of the full key kept in the clear for display/identification: the prefix
# plus 8 token chars, e.g. "atb_a1b2c3d4". Never enough to reconstruct the key.
DISPLAY_PREFIX_LEN = len(KEY_PREFIX) + 8


def hash_key(raw: str) -> str:
    """SHA-256 hex digest of a raw key — what we store and look up by."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ApiKey(models.Model):
    """One programmatic-access credential for an organization."""

    class Scope(models.TextChoices):
        READ = "read", "Read only"
        READ_WRITE = "read_write", "Read & write"

    organization = models.ForeignKey(
        "accounts.Organization", on_delete=models.CASCADE, related_name="api_keys"
    )
    # The admin who minted it. The key acts with this user's access rights; kept
    # nullable so deleting the user doesn't orphan the audit trail (auth also
    # rejects a key whose creator is gone — see authentication.py).
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="api_keys"
    )
    name = models.CharField(max_length=120)
    scope = models.CharField(max_length=12, choices=Scope.choices, default=Scope.READ_WRITE)
    # First DISPLAY_PREFIX_LEN chars of the key — shown in the UI so an admin can
    # tell keys apart. Indexed only for display lookups; auth matches hashed_key.
    prefix = models.CharField(max_length=DISPLAY_PREFIX_LEN, db_index=True)
    hashed_key = models.CharField(max_length=64, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    # Optional hard expiry; blank = never expires (revoke to disable).
    expires_at = models.DateTimeField(null=True, blank=True)
    # Soft revoke: kept for the audit trail, but auth rejects it immediately.
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "revoked_at"])]

    def __str__(self):
        return f"ApiKey<{self.prefix}…> [{self.scope}] @ {self.organization_id}"

    # ── lifecycle ────────────────────────────────────────────────────────────
    @classmethod
    def generate(cls, *, organization, created_by, name, scope, expires_at=None):
        """Mint a new key. Returns (instance, raw_secret). The raw secret is the
        ONLY time the full key exists in plaintext — hand it to the caller once
        and never persist it."""
        raw = KEY_PREFIX + secrets.token_urlsafe(32)
        key = cls.objects.create(
            organization=organization,
            created_by=created_by,
            name=name.strip(),
            scope=scope,
            prefix=raw[:DISPLAY_PREFIX_LEN],
            hashed_key=hash_key(raw),
            expires_at=expires_at,
        )
        return key, raw

    def revoke(self):
        if self.revoked_at is None:
            self.revoked_at = timezone.now()
            self.save(update_fields=["revoked_at"])

    def touch_last_used(self):
        """Record use, but at most once a minute — avoids a DB write on every
        single request from a busy key while keeping 'last used' meaningful."""
        now = timezone.now()
        if self.last_used_at is None or (now - self.last_used_at).total_seconds() > 60:
            self.last_used_at = now
            self.save(update_fields=["last_used_at"])

    # ── status ───────────────────────────────────────────────────────────────
    @property
    def is_expired(self) -> bool:
        return self.expires_at is not None and self.expires_at <= timezone.now()

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    @property
    def is_usable(self) -> bool:
        return not self.is_revoked and not self.is_expired

    @property
    def status(self) -> str:
        if self.is_revoked:
            return "revoked"
        if self.is_expired:
            return "expired"
        return "active"
