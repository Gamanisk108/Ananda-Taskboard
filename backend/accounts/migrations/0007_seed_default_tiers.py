"""Seed the standard tier set for every existing organization.

The tier-customization UI was removed, so tiers can no longer be created by hand.
This backfills the fixed set (Volunteer/Coordinator/Lead) for orgs that predate
that change; new orgs get them at signup. Idempotent (get_or_create), and the
reverse is a no-op so we never destroy tiers an admin may rely on.
"""
from django.db import migrations

DEFAULT_TIERS = [
    ("Volunteer", "own"),
    ("Coordinator", "subproject"),
    ("Lead", "project"),
]


def seed_tiers(apps, schema_editor):
    Organization = apps.get_model("accounts", "Organization")
    Tier = apps.get_model("accounts", "Tier")
    for org in Organization.objects.all():
        for name, sees in DEFAULT_TIERS:
            Tier.objects.get_or_create(
                organization=org, name=name, defaults={"default_sees": sees}
            )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0006_seed_default_org"),
    ]
    operations = [
        migrations.RunPython(seed_tiers, noop),
    ]
