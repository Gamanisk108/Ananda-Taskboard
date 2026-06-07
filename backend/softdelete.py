"""Soft-delete base: deleting sets `deleted_at` instead of removing the row, so
items can be restored within a retention window (purged later by a command).

`objects` returns only live rows (so the rest of the app is unaffected);
`all_objects` includes soft-deleted rows (for the Trash views and purge job).
"""

from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def dead(self):
        return self.filter(deleted_at__isnull=False)


class SoftDeleteManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class AllObjectsManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    pass


class SoftDeleteModel(models.Model):
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = SoftDeleteManager()      # live only (default manager)
    all_objects = AllObjectsManager()  # includes soft-deleted

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        """Soft delete (mark). Use hard_delete() to actually remove.

        If the concrete model tracks `deleted_by` (e.g. Task) and the caller set
        it before deleting, that attribution is persisted too."""
        if self.deleted_at is None:
            self.deleted_at = timezone.now()
            fields = ["deleted_at"]
            if hasattr(self, "deleted_by_id") and self.deleted_by_id is not None:
                fields.append("deleted_by")
            self.save(update_fields=fields)

    def hard_delete(self, using=None, keep_parents=False):
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        self.deleted_at = None
        fields = ["deleted_at"]
        if hasattr(self, "deleted_by_id"):
            self.deleted_by = None  # clear attribution once it's live again
            fields.append("deleted_by")
        self.save(update_fields=fields)
