"""Shared cross-tenant write guards.

A recurring bug class across this codebase: a serializer/view accepts a
client-supplied id for a SubProject/Project/Group/Tier/User (a plain
`PrimaryKeyRelatedField(queryset=Model.objects.all())`, or a raw
`Model.objects.filter(pk=value).first()`) and later writes it onto a row —
with nothing checking that the referenced object actually belongs to the
caller's active organization. An org admin is only authorized inside their
OWN org, so any such unchecked FK write lets them reach into another tenant's
data (reparent a sub-project, mint a grant/exclusion, bulk-move a task,
assign a foreign user).

These helpers are the ONE place that check; call one at the point a
cross-org-capable id is about to be saved (serializer.validate(), or a
view's perform_create/perform_update) rather than adding a one-off filter at
each call site. Found + fixed 2026-07-19 (deep security audit).
"""

from rest_framework.exceptions import ValidationError


def require_org(org, obj, org_id_of, label):
    """Raise ValidationError unless `obj` (may be None — nothing to check)
    belongs to `org`. `org_id_of(obj)` resolves obj -> its organization_id.

    `org is None` means legacy/no-X-Org-Id-header mode, which the rest of the
    engine already treats as unscoped/global (see permissions/engine.py's
    module docstring and every `if org is not None:` guard alongside this
    one) — so this is a no-op then, exactly like those, rather than a new
    stricter rule real request headers never trigger."""
    if obj is None or org is None:
        return
    if org_id_of(obj) != org.id:
        raise ValidationError({"detail": f"That {label} does not belong to your active organization."})


def subproject_org_id(sp):
    return sp.project.organization_id


def project_org_id(p):
    return p.organization_id


def group_org_id(g):
    return g.organization_id


def tier_org_id(t):
    return t.organization_id


def task_org_id(t):
    return t.subproject.project.organization_id


def require_users_in_org(org, users, label="user"):
    """Raise ValidationError unless every user in `users` holds an active
    Membership in `org`. `users` may be any iterable of User instances.
    No-op in legacy/no-org-header mode (org is None) — see require_org."""
    users = list(users or [])
    if not users or org is None:
        return
    from accounts.models import Membership

    ids = {u.id for u in users}
    in_org = set(
        Membership.objects.filter(user_id__in=ids, organization=org, is_active=True)
        .values_list("user_id", flat=True)
    )
    missing = ids - in_org
    if missing:
        raise ValidationError({"detail": f"One or more {label}s are not members of your active organization."})


def require_groups_in_org(org, groups, label="group"):
    """Raise ValidationError unless every group in `groups` belongs to `org`.
    No-op in legacy/no-org-header mode (org is None) — see require_org."""
    groups = list(groups or [])
    if not groups or org is None:
        return
    if any(g.organization_id != org.id for g in groups):
        raise ValidationError({"detail": f"One or more {label}s do not belong to your active organization."})
