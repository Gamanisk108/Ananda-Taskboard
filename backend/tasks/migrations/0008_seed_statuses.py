from django.db import migrations

DEFAULTS = [
    ("todo", "To Do", "#6b7280", 0, False, True),
    ("in_progress", "In Progress", "#2f7d74", 1, False, False),
    ("delayed", "Delayed", "#b7791f", 2, False, False),
    ("done", "Done", "#4f7a3c", 3, True, False),
]


def seed(apps, schema_editor):
    Status = apps.get_model("tasks", "Status")
    for key, label, color, order, is_complete, is_initial in DEFAULTS:
        Status.objects.get_or_create(
            key=key,
            defaults={"label": label, "color": color, "order": order,
                      "is_complete": is_complete, "is_initial": is_initial},
        )


def unseed(apps, schema_editor):
    apps.get_model("tasks", "Status").objects.filter(
        key__in=[d[0] for d in DEFAULTS]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("tasks", "0007_status")]
    operations = [migrations.RunPython(seed, unseed)]
