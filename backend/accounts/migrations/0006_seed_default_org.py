"""Data migration: fold the existing single-tenant data into one Organization.

Creates an "Ananda Los Angeles" org, attaches every existing project/group/tier
to it, and gives each existing user an admin/member Membership carrying their
pre-tenancy role + tier. Idempotent and safe on a fresh (empty) database.
"""

from django.db import migrations

DEFAULT_ORG_NAME = "Ananda Los Angeles"


def forward(apps, schema_editor):
    Organization = apps.get_model("accounts", "Organization")
    User = apps.get_model("accounts", "User")
    Membership = apps.get_model("accounts", "Membership")
    Group = apps.get_model("accounts", "Group")
    Tier = apps.get_model("accounts", "Tier")
    Project = apps.get_model("projects", "Project")

    # Fresh DB → nothing to fold; self-serve signup will create orgs from scratch.
    if not User.objects.exists() and not Project.objects.exists():
        return

    org, _ = Organization.objects.get_or_create(
        name=DEFAULT_ORG_NAME,
        defaults={"city": "Los Angeles", "country": "USA", "is_active": True},
    )

    Project.objects.filter(organization__isnull=True).update(organization=org)
    Group.objects.filter(organization__isnull=True).update(organization=org)
    Tier.objects.filter(organization__isnull=True).update(organization=org)

    for u in User.objects.all():
        Membership.objects.get_or_create(
            user=u,
            organization=org,
            defaults={"role": u.role, "tier_id": u.tier_id, "is_active": u.is_active},
        )

    creator = (
        User.objects.filter(is_superuser=True).order_by("id").first()
        or User.objects.filter(role="admin").order_by("id").first()
    )
    if creator and org.created_by_id is None:
        org.created_by = creator
        org.save(update_fields=["created_by"])


def backward(apps, schema_editor):
    # Detach the seed org without deleting projects/users.
    Organization = apps.get_model("accounts", "Organization")
    Project = apps.get_model("projects", "Project")
    Group = apps.get_model("accounts", "Group")
    Tier = apps.get_model("accounts", "Tier")
    Project.objects.filter(organization__name=DEFAULT_ORG_NAME).update(organization=None)
    Group.objects.filter(organization__name=DEFAULT_ORG_NAME).update(organization=None)
    Tier.objects.filter(organization__name=DEFAULT_ORG_NAME).update(organization=None)
    Organization.objects.filter(name=DEFAULT_ORG_NAME).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_alter_group_name_alter_tier_name_organization_and_more"),
        ("projects", "0004_project_organization"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
