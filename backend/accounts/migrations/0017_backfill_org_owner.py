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
            # Only an ACTIVE creator membership — never resurrect a deactivated one.
            chosen = Membership.objects.filter(
                organization=org, user_id=org.created_by_id, is_active=True
            ).first()
        if chosen is None:
            # Earliest active admin, else earliest active member ('admin' < 'member'
            # lexically → admins first). An org with zero active members is left
            # owner-less by design — there is no one to own it.
            chosen = (
                Membership.objects.filter(organization=org, is_active=True)
                .order_by("role", "created_at")
                .first()
            )
        if chosen is not None:
            chosen.role = "owner"
            chosen.save(update_fields=["role"])


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
