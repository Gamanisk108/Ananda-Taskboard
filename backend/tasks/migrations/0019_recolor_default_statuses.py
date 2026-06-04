"""Recolor the default statuses to the Claude Design palette — but only for rows
still at the original seeded color, so any admin customizations are preserved.
  in_progress  #2f7d74 (teal)  -> #2c64a8 (azure/blue)
  delayed      #b7791f (gold)  -> #bb3b28 (terracotta)
  done         #4f7a3c (green) -> #3f7d54 (green, tuned)
  todo         unchanged (#6b7280)
"""
from django.db import migrations

RECOLOR = [
    ("in_progress", "#2f7d74", "#2c64a8"),
    ("delayed", "#b7791f", "#bb3b28"),
    ("done", "#4f7a3c", "#3f7d54"),
]


def forward(apps, schema_editor):
    Status = apps.get_model("tasks", "Status")
    for key, old, new in RECOLOR:
        Status.objects.filter(key=key, color__iexact=old).update(color=new)


def backward(apps, schema_editor):
    Status = apps.get_model("tasks", "Status")
    for key, old, new in RECOLOR:
        Status.objects.filter(key=key, color__iexact=new).update(color=old)


class Migration(migrations.Migration):
    dependencies = [("tasks", "0018_comment_mentions")]
    operations = [migrations.RunPython(forward, backward)]
