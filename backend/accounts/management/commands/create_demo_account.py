"""Create (or refresh) a read-only DEMO account for store review / showcasing.

    python manage.py create_demo_account [--org "Ananda LA"] [--password <pw>]

Idempotent: re-running updates the password and re-asserts the viewer grants.
The account is a member-role user with VIEWER-level grants on every project of
the org — they can look at everything and change nothing (server-enforced).
"""

import secrets

from django.core.management.base import BaseCommand, CommandError

from accounts.models import Membership, Organization, User
from permissions.models import AccessGrant
from projects.models import Project

DEMO_EMAIL = "demo@ananda.test"


class Command(BaseCommand):
    help = "Create or refresh the read-only demo account"

    def add_arguments(self, parser):
        parser.add_argument("--org", default=None, help="Organization name (default: first org)")
        parser.add_argument("--password", default=None, help="Password (default: random, printed)")

    def handle(self, *args, **opts):
        org = (
            Organization.objects.filter(name=opts["org"]).first()
            if opts["org"] else Organization.objects.order_by("id").first()
        )
        if org is None:
            raise CommandError("No organization found — seed or create one first.")

        password = opts["password"] or secrets.token_urlsafe(9)
        user, created = User.objects.get_or_create(email=DEMO_EMAIL, defaults={"name": "Demo Visitor"})
        user.set_password(password)
        user.save()

        Membership.objects.get_or_create(user=user, organization=org, defaults={"role": "member", "is_active": True})

        # Viewer on every (whole) project of the org — sees all, edits nothing.
        for project in Project.objects.filter(organization=org):
            AccessGrant.objects.get_or_create(user=user, project=project, defaults={"level": "viewer"})

        self.stdout.write(self.style.SUCCESS(
            f"Demo account {'created' if created else 'refreshed'} for org “{org.name}”: "
            f"{DEMO_EMAIL} / {password}"
        ))
