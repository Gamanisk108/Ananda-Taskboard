"""Share links — a bearer token that lets any chat platform (Slack, WhatsApp,
iMessage, Discord, Telegram, …) unfurl a Project / Sub-project / Task / Sub-task
into a rich preview card, WITHOUT logging in.

The token route exposes ONLY card metadata (name · priority · status · assignee ·
breadcrumb · description excerpt). Clicking through still lands in the auth-gated
SPA, so full data stays behind normal permissions. One durable link per object
(re-sharing returns the same URL); revoking mints a fresh one next time.
"""

import secrets

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

# The four shareable models, keyed by the `type` the API/SPA speak. Kept as
# (app_label, model) so we never import the models here (avoids a cycle).
SHAREABLE = {
    "project": ("projects", "project"),
    "subproject": ("projects", "subproject"),
    "task": ("tasks", "task"),
    "subtask": ("tasks", "subtask"),
}
# Reverse map: (app_label, model) -> public type string.
_TYPE_BY_MODEL = {v: k for k, v in SHAREABLE.items()}


def type_for(obj) -> str | None:
    """Public `type` string for a model instance, or None if not shareable."""
    return _TYPE_BY_MODEL.get((obj._meta.app_label, obj._meta.model_name))


def _gen_token() -> str:
    # 16 bytes -> 22 url-safe chars: unguessable, treat as an API key.
    return secrets.token_urlsafe(16)


class ShareLinkManager(models.Manager):
    def active_for(self, obj):
        """The current (non-revoked) link for an object, or None."""
        ct = ContentType.objects.get_for_model(obj)
        return self.filter(content_type=ct, object_id=obj.pk, revoked_at__isnull=True).first()

    def get_or_create_for(self, obj, *, user, org):
        """Durable link per object: return the live one, else mint a fresh token.
        Concurrency-safe — if two requests race past `active_for`, the loser hits
        the `one_active_link_per_object` partial-unique constraint and we return
        the winner instead of 500-ing."""
        from django.db import IntegrityError, transaction

        existing = self.active_for(obj)
        if existing:
            return existing, False
        ct = ContentType.objects.get_for_model(obj)
        try:
            with transaction.atomic():
                link = self.create(content_type=ct, object_id=obj.pk, organization=org, created_by=user)
            return link, True
        except IntegrityError:
            return self.active_for(obj), False


class ShareLink(models.Model):
    token = models.CharField(
        max_length=64, unique=True, default=_gen_token, editable=False, db_index=True
    )
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    target = GenericForeignKey("content_type", "object_id")

    # Denormalized tenant — every shareable object resolves to exactly one org;
    # storing it keeps cleanup/scoping cheap and independent of the target row.
    organization = models.ForeignKey(
        "accounts.Organization", on_delete=models.CASCADE, related_name="share_links"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="share_links"
    )
    # Description on by default (Gordon, 2026-06-29); a per-link toggle can suppress it.
    include_description = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Links live forever unless explicitly revoked. Revoked -> 410 + no meta.
    revoked_at = models.DateTimeField(null=True, blank=True)

    objects = ShareLinkManager()

    class Meta:
        constraints = [
            # At most ONE active link per object; revoked rows are kept for audit.
            models.UniqueConstraint(
                fields=["content_type", "object_id"],
                condition=models.Q(revoked_at__isnull=True),
                name="one_active_link_per_object",
            )
        ]
        indexes = [models.Index(fields=["content_type", "object_id"])]

    def __str__(self):
        return f"ShareLink<{self.token}> -> {self.content_type.model}#{self.object_id}"

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    @property
    def public_type(self) -> str | None:
        return _TYPE_BY_MODEL.get((self.content_type.app_label, self.content_type.model))
