"""Seed a small demo dataset for local dev / verification.

    python manage.py seed_demo

Creates an admin, two members, groups, projects/sub-projects, grants, and a mix
of tasks (approved, pending, recurring, overdue). Idempotent-ish: safe to re-run
on an empty DB; will create duplicates if run repeatedly on a populated one.
"""

from datetime import date, timedelta

from django.core.management.base import BaseCommand

from accounts.models import Group, User
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import RecurrenceRule, Task


class Command(BaseCommand):
    help = "Seed demo data"

    def handle(self, *args, **opts):
        # Idempotent guard: if any project exists, assume already seeded and skip
        # (so re-running on every deploy doesn't duplicate or crash on unique names).
        if Project.objects.exists():
            self.stdout.write("Already seeded; skipping.")
            return

        admin, _ = User.objects.get_or_create(
            email="admin@ananda.test", defaults={"name": "Admin Ada", "role": User.Role.ADMIN, "is_staff": True, "is_superuser": True}
        )
        admin.set_password("taskboard123")
        admin.save()

        mara, _ = User.objects.get_or_create(email="mara@ananda.test", defaults={"name": "Mara Member"})
        mara.set_password("taskboard123"); mara.save()
        omar, _ = User.objects.get_or_create(email="omar@ananda.test", defaults={"name": "Omar Member"})
        omar.set_password("taskboard123"); omar.save()

        alliance = Group.objects.create(name="Alliance")
        alliance.members.add(mara, omar)

        karuna = Project.objects.create(name="Karuna Devi")
        marketing = SubProject.objects.create(project=karuna, name="Marketing")
        warehouse = SubProject.objects.create(project=karuna, name="Warehouse")
        sunday = Project.objects.create(name="Sunday Service")  # only default sub-project

        # Grants: Mara sees Marketing (member) + Sunday (member, trusted); Omar Warehouse viewer.
        AccessGrant.objects.create(user=mara, subproject=marketing, level="member")
        AccessGrant.objects.create(group=alliance, subproject=sunday.subprojects.first(), level="member")
        AccessGrant.objects.create(user=omar, subproject=warehouse, level="viewer")
        sunday.subprojects.update(members_post_without_approval=True)

        today = date.today()
        Task.objects.create(subproject=marketing, title="Design spring flyer", deadline=today + timedelta(days=3), created_by=admin)
        Task.objects.create(subproject=marketing, title="Overdue: send newsletter", deadline=today - timedelta(days=2), status="todo", created_by=admin)
        Task.objects.create(subproject=marketing, title="Member proposal (pending)", approval_state="pending", created_by=mara)
        rr = RecurrenceRule.objects.create(freq="weekly", interval=1, anchor=today)
        Task.objects.create(subproject=sunday.subprojects.first(), title="Weekly service prep", recurrence_rule=rr, created_by=admin)
        Task.objects.create(subproject=warehouse, title="Stock count", deadline=today + timedelta(days=7), created_by=admin)

        self.stdout.write(self.style.SUCCESS(
            "Seeded. Logins (password 'taskboard123'): admin@ananda.test, mara@ananda.test, omar@ananda.test"
        ))
