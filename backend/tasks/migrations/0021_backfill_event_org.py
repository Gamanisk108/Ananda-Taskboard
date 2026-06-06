"""Attach any pre-existing CalendarEvents to the seed org (Ananda Los Angeles),
matching how projects/groups/tiers were folded in. No-op on a fresh DB."""

from django.db import migrations

DEFAULT_ORG_NAME = "Ananda Los Angeles"


def forward(apps, schema_editor):
    CalendarEvent = apps.get_model("tasks", "CalendarEvent")
    Organization = apps.get_model("accounts", "Organization")
    if not CalendarEvent.objects.filter(organization__isnull=True).exists():
        return
    org = (
        Organization.objects.filter(name=DEFAULT_ORG_NAME).first()
        or Organization.objects.order_by("id").first()
    )
    if org:
        CalendarEvent.objects.filter(organization__isnull=True).update(organization=org)


class Migration(migrations.Migration):
    dependencies = [
        ("tasks", "0020_calendarevent_organization"),
        ("accounts", "0006_seed_default_org"),
    ]

    operations = [migrations.RunPython(forward, migrations.RunPython.noop)]
