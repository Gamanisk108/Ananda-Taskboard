"""Delete organization(s) — for cleaning up test/abandoned tenants.

Cannot be run against the deployed DB from a dev machine; run it in the Render
shell (or any env pointed at the target DB):

    python backend/manage.py delete_org --purge-unverified --dry-run
    python backend/manage.py delete_org --purge-unverified --yes
    python backend/manage.py delete_org --id 7 --yes
    python backend/manage.py delete_org --name "Audit Test Org" --yes --delete-orphan-users

Deleting an Organization cascades to its memberships, projects, tasks, etc.
Users are SET_NULL on the org's created_by, so accounts left with zero
memberships can be removed with --delete-orphan-users.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Organization, User


class Command(BaseCommand):
    help = "Delete organization(s) by id/name, or purge unverified (is_active=False) orgs."

    def add_arguments(self, parser):
        parser.add_argument("--id", type=int, action="append", default=[], help="Org id(s) to delete (repeatable).")
        parser.add_argument("--name", type=str, action="append", default=[], help="Exact org name(s) to delete (repeatable).")
        parser.add_argument("--purge-unverified", action="store_true", help="Delete every org with is_active=False (pending verification).")
        parser.add_argument("--delete-orphan-users", action="store_true", help="Also delete users left with zero memberships.")
        parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted, change nothing.")
        parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt (required for non-interactive deletes).")

    def handle(self, *args, **opts):
        qs = Organization.objects.none()
        if opts["purge_unverified"]:
            qs = qs | Organization.objects.filter(is_active=False)
        if opts["id"]:
            qs = qs | Organization.objects.filter(id__in=opts["id"])
        if opts["name"]:
            qs = qs | Organization.objects.filter(name__in=opts["name"])
        qs = qs.distinct()

        if not (opts["purge_unverified"] or opts["id"] or opts["name"]):
            raise CommandError("Specify --id, --name, and/or --purge-unverified.")
        if not qs.exists():
            self.stdout.write(self.style.WARNING("No matching organizations."))
            return

        self.stdout.write("Organizations targeted for deletion:")
        for org in qs:
            members = org.memberships.count()
            self.stdout.write(
                f"  · id={org.id}  {org.name!r}  active={org.is_active}  members={members}"
            )

        if opts["dry_run"]:
            self.stdout.write(self.style.NOTICE("--dry-run: nothing deleted."))
            return

        if not opts["yes"]:
            confirm = input(f"Delete {qs.count()} org(s) and ALL their data? Type 'delete' to confirm: ")
            if confirm.strip().lower() != "delete":
                self.stdout.write(self.style.WARNING("Aborted."))
                return

        with transaction.atomic():
            candidate_user_ids = set()
            if opts["delete_orphan_users"]:
                for org in qs:
                    candidate_user_ids.update(org.memberships.values_list("user_id", flat=True))
            deleted = qs.delete()
            self.stdout.write(self.style.SUCCESS(f"Deleted orgs + cascade: {deleted}"))

            if opts["delete_orphan_users"] and candidate_user_ids:
                orphans = User.objects.filter(id__in=candidate_user_ids).exclude(
                    memberships__isnull=False
                )
                n = orphans.count()
                orphans.delete()
                self.stdout.write(self.style.SUCCESS(f"Deleted {n} orphaned user(s)."))
