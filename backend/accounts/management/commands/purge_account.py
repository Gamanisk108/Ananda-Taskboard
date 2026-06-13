"""Permanently delete specific user account(s) by email — for cleaning up test
sign-ups. For each user: deletes any org they CREATED that has no OTHER active
members (a solo test org), then deletes the user. Refuses to touch an org that
has other active members. Run in the Render shell or a one-off job:

    python manage.py purge_account a@b.com c@d.com --dry-run
    python manage.py purge_account a@b.com c@d.com --yes

Deleting an org cascades its memberships/projects/tasks; deleting a user cascades
their memberships, AI-generation logs, etc. (shared content is SET_NULL).
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Membership, Organization, User


class Command(BaseCommand):
    help = "Delete user account(s) by email plus the solo orgs they created."

    def add_arguments(self, parser):
        parser.add_argument("emails", nargs="+", help="Email(s) of the account(s) to purge.")
        parser.add_argument("--dry-run", action="store_true", help="Show the plan, change nothing.")
        parser.add_argument("--yes", action="store_true", help="Required to actually delete (non-interactive).")

    def handle(self, *args, **opts):
        emails = [e.strip().lower() for e in opts["emails"]]
        users = list(User.objects.filter(email__in=emails))
        found = {u.email for u in users}
        for e in emails:
            if e not in found:
                self.stdout.write(f"(no account for {e})")

        orgs_to_delete, orgs_skipped = [], []
        for u in users:
            for org in Organization.objects.filter(created_by=u):
                has_others = (
                    Membership.objects.filter(organization=org, is_active=True)
                    .exclude(user=u).exists()
                )
                (orgs_skipped if has_others else orgs_to_delete).append(org)

        self.stdout.write(f"Users to delete ({len(users)}): {sorted(found)}")
        self.stdout.write(f"Solo orgs to delete ({len(orgs_to_delete)}): {[(o.id, o.name) for o in orgs_to_delete]}")
        if orgs_skipped:
            self.stdout.write(self.style.WARNING(
                f"SKIPPED (have other active members): {[(o.id, o.name) for o in orgs_skipped]}"))

        if opts["dry_run"]:
            self.stdout.write(self.style.NOTICE("dry-run — nothing changed."))
            return
        if not opts["yes"]:
            raise CommandError("Refusing to delete without --yes (or use --dry-run).")

        with transaction.atomic():
            for org in orgs_to_delete:
                org.delete()
            for u in users:
                u.delete()
        self.stdout.write(self.style.SUCCESS(f"Purged {len(users)} account(s) and {len(orgs_to_delete)} org(s)."))
