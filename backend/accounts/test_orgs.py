"""Multi-tenant model layer: Organization, Membership, and per-org uniqueness
of Group/Tier names. (Engine-level isolation is covered in permissions tests.)"""

import pytest
from django.db import IntegrityError, transaction

from accounts.models import Group, Membership, Organization, Tier, User


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Ananda Portland", city="Portland", country="USA", is_active=True)


@pytest.fixture
def other_org(db):
    return Organization.objects.create(name="Ananda Assisi", city="Assisi", country="Italy", is_active=True)


@pytest.fixture
def user(db):
    return User.objects.create_user(email="seva@example.com", name="Seva", password="pw-strong-123")


def test_organization_defaults_to_inactive(db):
    o = Organization.objects.create(name="Pending Center")
    assert o.is_active is False  # activates only after email verification


def test_membership_role_admin_property(org, user):
    m = Membership.objects.create(user=user, organization=org, role=Membership.Role.ADMIN)
    assert m.is_admin is True
    m2 = Membership.objects.create(user=user, organization=Organization.objects.create(name="X"), role="member")
    assert m2.is_admin is False


def test_one_membership_per_user_org(org, user):
    Membership.objects.create(user=user, organization=org, role="member")
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Membership.objects.create(user=user, organization=org, role="admin")


def test_user_can_belong_to_many_orgs(org, other_org, user):
    Membership.objects.create(user=user, organization=org, role="admin")
    Membership.objects.create(user=user, organization=other_org, role="member")
    assert user.memberships.count() == 2
    assert {m.organization_id for m in user.memberships.all()} == {org.id, other_org.id}


def test_group_name_unique_within_org_not_across(org, other_org):
    Group.objects.create(organization=org, name="Volunteers")
    # Same name in a different org is fine.
    Group.objects.create(organization=other_org, name="Volunteers")
    # Duplicate within the same org is rejected.
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Group.objects.create(organization=org, name="Volunteers")


def test_tier_name_unique_within_org_not_across(org, other_org):
    Tier.objects.create(organization=org, name="Coordinator")
    Tier.objects.create(organization=other_org, name="Coordinator")
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Tier.objects.create(organization=org, name="Coordinator")
