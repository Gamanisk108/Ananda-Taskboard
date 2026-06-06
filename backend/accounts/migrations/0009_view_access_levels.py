"""Rename the tier set to the new "View Access" levels, add the Organization
level, and give every existing member a View Access.

  Volunteer    -> Tasks Only        (own)
  Coordinator  -> Sub-Project Only   (subproject)
  Lead         -> Full Project       (project)
  (new)         Organization         (org)

View Access is now the member's single visibility control (permissions/engine.py
reads the tier's breadth directly). To avoid silently shrinking what existing
members can see, members without a View Access are backfilled to "Sub-Project
Only" — which matches the pre-change default of seeing their whole sub-project.
Idempotent and reversible (best-effort).
"""
from django.db import migrations

RENAMES = [
    ("Volunteer", "Tasks Only"),
    ("Coordinator", "Sub-Project Only"),
    ("Lead", "Full Project"),
]
ORG_LEVEL = ("Organization", "org")
BACKFILL_NAME = "Sub-Project Only"


def _scope(org):
    return {"organization": org} if org is not None else {"organization__isnull": True}


def forward(apps, schema_editor):
    Tier = apps.get_model("accounts", "Tier")
    Organization = apps.get_model("accounts", "Organization")
    Membership = apps.get_model("accounts", "Membership")

    def rename_and_seed(org, seed=True):
        scope = _scope(org)
        for old, new in RENAMES:
            t = Tier.objects.filter(name=old, **scope).first()
            if t and not Tier.objects.filter(name=new, **scope).exists():
                t.name = new
                t.save(update_fields=["name"])
        # Only seed the new Organization level for a REAL org. Never create a stray
        # global (org=None) tier — those rows are legacy-only; here we just rename them.
        if seed:
            name, sees = ORG_LEVEL
            if not Tier.objects.filter(name=name, **scope).exists():
                Tier.objects.create(name=name, default_sees=sees, organization=org)

    for org in Organization.objects.all():
        rename_and_seed(org)
    rename_and_seed(None, seed=False)  # legacy/global tiers (org=None): rename only

    # Backfill members lacking a View Access → "Sub-Project Only" for their org.
    for m in Membership.objects.filter(role="member", tier__isnull=True):
        t = Tier.objects.filter(organization_id=m.organization_id, name=BACKFILL_NAME).first()
        if t:
            m.tier_id = t.id
            m.save(update_fields=["tier"])


def backward(apps, schema_editor):
    Tier = apps.get_model("accounts", "Tier")
    Organization = apps.get_model("accounts", "Organization")

    def revert(org):
        scope = _scope(org)
        for old, new in RENAMES:  # rename new -> old
            t = Tier.objects.filter(name=new, **scope).first()
            if t and not Tier.objects.filter(name=old, **scope).exists():
                t.name = old
                t.save(update_fields=["name"])
        Tier.objects.filter(name=ORG_LEVEL[0], **scope).delete()

    for org in Organization.objects.all():
        revert(org)
    revert(None)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0008_invitation")]
    operations = [migrations.RunPython(forward, backward)]
