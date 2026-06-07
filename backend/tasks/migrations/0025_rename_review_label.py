"""Rename the review status label "Ready for Review" → "Review".

Non-destructive: only updates the row that still carries the original default label,
so an admin who renamed it keeps their choice. Reverses back to the old default.
"""
from django.db import migrations

OLD = "Ready for Review"
NEW = "Review"


def rename(apps, schema_editor):
    Status = apps.get_model("tasks", "Status")
    Status.objects.filter(key="review", label=OLD).update(label=NEW)


def unrename(apps, schema_editor):
    Status = apps.get_model("tasks", "Status")
    Status.objects.filter(key="review", label=NEW).update(label=OLD)


class Migration(migrations.Migration):
    dependencies = [("tasks", "0024_alter_task_status_alter_taskoccurrence_status")]
    operations = [migrations.RunPython(rename, unrename)]
