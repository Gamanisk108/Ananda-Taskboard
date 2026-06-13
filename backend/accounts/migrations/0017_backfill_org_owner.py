"""Backfill the Owner role: every existing org gets exactly one owner — its
creator (`created_by`) if they have a membership, else the earliest active admin.
Idempotent and reversible (reverse demotes owners back to admin)."""

from django.db import migrations


def set_owners(apps, schema_editor):
    Organization = apps.get_model("accounts", "Organization")
    Membership = apps.get_model("accounts", "Membership")
    for org in Organization.objects.all():
        if Membership.objects.filter(organization=org, role="owner").exists():
            continue  # already has an owner
        chosen = None
        if org.created_by_id:
            chosen = Membership.objects.filter(
                organization=org, user_id=org.created_by_id
            ).first()
        if chosen is None:
            chosen = (
                Membership.objects.filter(organization=org, role="admin", is_active=True)
                .order_by("created_at")
                .first()
            )
        if chosen is not None:
            chosen.role = "owner"
            chosen.is_active = True
            chosen.save(update_fields=["role", "is_active"])


def unset_owners(apps, schema_editor):
    Membership = apps.get_model("accounts", "Membership")
    Membership.objects.filter(role="owner").update(role="admin")


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0016_alter_invitation_role_alter_membership_role"),
    ]

    operations = [
        migrations.RunPython(set_owners, unset_owners),
    ]
