"""AI generation daily rate guard: per-user, per-org, UTC-day scoped."""

import pytest

from accounts.models import Organization, User
from ai.models import AiGeneration, DAILY_LIMIT, can_generate, generations_today, remaining_today

PW = "pw-strong-123"


@pytest.fixture
def org(db):
    return Organization.objects.create(name="AI Org", is_active=True)


@pytest.fixture
def other_org(db):
    return Organization.objects.create(name="AI Org 2", is_active=True)


@pytest.fixture
def user(db):
    return User.objects.create_user(email="gen@x.com", name="Gen", password=PW)


def _bulk(user, org, n):
    AiGeneration.objects.bulk_create([AiGeneration(user=user, organization=org) for _ in range(n)])


def test_counts_start_at_zero(user, org):
    assert generations_today(user, org) == 0
    assert remaining_today(user, org) == DAILY_LIMIT
    assert can_generate(user, org) is True


def test_cap_blocks_after_limit(user, org):
    _bulk(user, org, DAILY_LIMIT - 1)
    assert can_generate(user, org) is True          # 19 used → 20th allowed
    AiGeneration.objects.create(user=user, organization=org)
    assert generations_today(user, org) == DAILY_LIMIT
    assert can_generate(user, org) is False          # 20 used → 21st blocked
    assert remaining_today(user, org) == 0


def test_scoped_per_org(user, org, other_org):
    _bulk(user, org, DAILY_LIMIT)
    assert can_generate(user, org) is False
    assert can_generate(user, other_org) is True     # other org unaffected


def test_scoped_per_user(user, org):
    _bulk(user, org, DAILY_LIMIT)
    other = User.objects.create_user(email="two@x.com", name="Two", password=PW)
    assert can_generate(other, org) is True          # other user unaffected
