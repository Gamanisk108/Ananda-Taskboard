"""Seed the 'Ready for Review' status between Delayed and Done.

Purple (#7A5AA6, from the Claude Design palette). Inserted at order 3; Done is
bumped to order 4 so the column lands between Delayed and Done. Idempotent and
non-destructive: an admin who already renamed/recolored Done keeps their changes
(we only nudge its order), and re-running never duplicates the review row.
"""
from django.db import migrations

REVIEW = ("review", "Ready for Review", "#7A5AA6", 3, False, False)


def seed(apps, schema_editor):
    Status = apps.get_model("tasks", "Status")
    key, label, color, order, is_complete, is_initial = REVIEW
    Status.objects.get_or_create(
        key=key,
        defaults={"label": label, "color": color, "order": order,
                  "is_complete": is_complete, "is_initial": is_initial},
    )
    # Make room: push Done (and anything at/after the review slot) down one, but
    # only the still-default Done so a custom reorder isn't clobbered.
    Status.objects.filter(key="done", order=3).update(order=4)


def unseed(apps, schema_editor):
    Status = apps.get_model("tasks", "Status")
    Status.objects.filter(key="review").delete()
    Status.objects.filter(key="done", order=4).update(order=3)


class Migration(migrations.Migration):
    dependencies = [("tasks", "0021_backfill_event_org")]
    operations = [migrations.RunPython(seed, unseed)]
