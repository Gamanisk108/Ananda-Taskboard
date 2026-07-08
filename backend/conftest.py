"""Repo-wide pytest fixtures.

Autouse cache clearing: DRF's ScopedRateThrottle (used on login/signup/
verify-email/password-reset) counts requests in Django's cache, which is
process-global LocMemCache and is NOT reset between tests by pytest-django
(only the DB is transaction-rolled-back per test). Dozens of test files
across the suite call POST /api/auth/login as a login helper for unrelated
tests; without clearing the cache between tests, the throttle counters
accumulate across the whole run and legitimate logins start returning 429
partway through the suite. Clear it before AND after every test so counts
never bleed across test boundaries or across the whole session.
"""

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()
