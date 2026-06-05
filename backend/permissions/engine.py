"""The permission engine — ONE place that computes a user's effective access.

Every queryset, endpoint, export, push, and summary derives visibility from here.

Effective access = union of the user's direct grants + all their groups' grants +
their tier's grants; most-permissive level wins (member > viewer) and widest "sees"
wins (project > subproject > own). Whole-project grants expand to all of that
project's sub-projects, computed live, so newly added sub-projects are covered
automatically and group/tier changes take effect immediately.

Multi-tenancy
-------------
Every function takes an optional `org` (Organization). When `org` is given the
result is scoped to that tenant and gated on an ACTIVE membership in it (no
membership → no access, even if a stray grant exists), with the user's tier and
groups read from that membership/org. There is NO cross-org bypass: a platform
superuser sees an org's data only if they hold a membership in it, exactly like
anyone else — the platform owner gets metadata-only stats elsewhere, never the
contents of an org they don't belong to. When `org` is None the engine runs in
legacy/global mode (pre-tenancy behavior) — used only by code paths and tests
that predate org context; post-migration, all real requests pass an org.

Two layers of visibility:
  1. Sub-project access  → access_map() / visible_subprojects(): which sub-projects
     the user can reach, and at what level + sees breadth.
  2. Task visibility      → visible_tasks_q(): which individual tasks are visible,
     applying the "own tasks only" narrowing and subtracting exclusions
     (deny > assignment > allow).

A grant's "sees":
  - own        → only tasks the user (or one of their groups) is assigned to.
  - subproject → all tasks in the granted sub-project(s).
  - project    → all tasks in the whole project — widens READ visibility to sibling
                 sub-projects of a granted sub-project (edit level still only applies
                 where actually granted).
"""

from collections import defaultdict

from django.db.models import Q

from accounts.models import SEES_OWN, SEES_PROJECT, SEES_RANK, SEES_SUBPROJECT

from .models import LEVEL_MEMBER, LEVEL_RANK, LEVEL_VIEWER, AccessGrant, Exclusion


# ── Org context helpers ────────────────────────────────────────────────────────

def is_org_admin(user, org=None):
    """Admin authority for this context. With an org → an active admin Membership
    in it (platform superuser status grants NO org admin power on its own). Without
    an org (legacy) → the deprecated global User.role admin flag."""
    if not (user and getattr(user, "is_authenticated", False)):
        return False
    if org is None:
        return getattr(user, "is_admin", False)
    from accounts.models import Membership
    return Membership.objects.filter(
        user=user, organization=org, role=Membership.Role.ADMIN, is_active=True
    ).exists()


def _in_org(user, org):
    """True if the user may operate in this org at all (active membership). The hard
    isolation gate: a non-member — INCLUDING a platform superuser — sees nothing in
    an org they don't belong to."""
    from accounts.models import Membership
    return Membership.objects.filter(user=user, organization=org, is_active=True).exists()


def _subject_ids(user, org):
    """(group_ids, tier_id) identifying this user as a grant/exclusion subject.
    Scoped to the org when given (groups in that org, tier from that membership);
    legacy/global otherwise (all groups, the deprecated User.tier)."""
    if org is None:
        return list(user.member_groups.values_list("id", flat=True)), getattr(user, "tier_id", None)
    group_ids = list(user.member_groups.filter(organization=org).values_list("id", flat=True))
    from accounts.models import Membership
    m = Membership.objects.filter(user=user, organization=org, is_active=True).first()
    return group_ids, (m.tier_id if m else None)


def access_map(user, org=None):
    """Return {subproject_id: {"level": level, "sees": sees}} for the user.

    Admins see every sub-project at member level / all tasks. A user with no
    grants sees {}. Sub-project- and project-level exclusions remove entries here
    (so a fully-hidden sub-project also disappears from the tree); finer-grained
    exclusions (task / assignee / group) are applied at the task level instead.
    """
    if not (user and user.is_authenticated):
        return {}
    # Isolation gate: outside this org (and not a superuser) → nothing.
    if org is not None and not _in_org(user, org):
        return {}

    from projects.models import SubProject

    if is_org_admin(user, org):
        sps = SubProject.objects.all()
        if org is not None:
            sps = sps.filter(project__organization=org)
        return {
            sp_id: {"level": LEVEL_MEMBER, "sees": SEES_SUBPROJECT}
            for sp_id in sps.values_list("id", flat=True)
        }

    group_ids, tier_id = _subject_ids(user, org)

    grants = AccessGrant.objects.filter(_subject_q(user, group_ids, tier_id))
    if org is not None:
        grants = grants.filter(
            Q(subproject__project__organization=org) | Q(project__organization=org)
        )
    grants = grants.values("level", "sees", "subproject_id", "project_id")

    # Sub-project → project for every directly granted sub-project (needed to widen
    # sees=project grants to sibling sub-projects).
    granted_sub_ids = {g["subproject_id"] for g in grants if g["subproject_id"] is not None}
    sub_to_proj = dict(
        SubProject.objects.filter(id__in=granted_sub_ids).values_list("id", "project_id")
    ) if granted_sub_ids else {}

    # Projects whose full sub-project list we need to expand: whole-project grants,
    # plus the parent project of any sees=project sub-project grant.
    whole_project_ids = {g["project_id"] for g in grants if g["project_id"] is not None}
    widen_project_ids = {
        sub_to_proj[g["subproject_id"]]
        for g in grants
        if g["subproject_id"] is not None and g["sees"] == SEES_PROJECT and g["subproject_id"] in sub_to_proj
    }
    expand_project_ids = whole_project_ids | widen_project_ids
    project_subprojects = defaultdict(list)
    if expand_project_ids:
        for sp_id, proj_id in SubProject.objects.filter(
            project_id__in=expand_project_ids
        ).values_list("id", "project_id"):
            project_subprojects[proj_id].append(sp_id)

    result = {}

    def _apply(sp_id, level, sees):
        cur = result.get(sp_id)
        if cur is None:
            result[sp_id] = {"level": level, "sees": sees}
            return
        if LEVEL_RANK[level] > LEVEL_RANK[cur["level"]]:
            cur["level"] = level
        if SEES_RANK[sees] > SEES_RANK[cur["sees"]]:
            cur["sees"] = sees

    for g in grants:
        if g["subproject_id"] is not None:
            _apply(g["subproject_id"], g["level"], g["sees"])
            if g["sees"] == SEES_PROJECT:
                proj_id = sub_to_proj.get(g["subproject_id"])
                # Read-only widening to siblings: see all their tasks, no edit rights.
                for sib_id in project_subprojects.get(proj_id, []):
                    _apply(sib_id, LEVEL_VIEWER, SEES_SUBPROJECT)
        elif g["project_id"] is not None:
            for sp_id in project_subprojects.get(g["project_id"], []):
                _apply(sp_id, g["level"], g["sees"])

    # Subtract sub-project / project level exclusions (whole-scope denies).
    if result:
        exc = excluded_targets(user, org, group_ids=group_ids, tier_id=tier_id)
        if exc["subprojects"] or exc["projects"]:
            sp_to_proj = dict(
                SubProject.objects.filter(id__in=result.keys()).values_list("id", "project_id")
            )
            for sp_id in list(result):
                if sp_id in exc["subprojects"] or sp_to_proj.get(sp_id) in exc["projects"]:
                    del result[sp_id]

    return result


def visible_subprojects(user, org=None):
    """Back-compat: {subproject_id: level} the user can see (drops the sees breadth)."""
    return {sp_id: info["level"] for sp_id, info in access_map(user, org).items()}


def visible_subproject_ids(user, org=None):
    return list(access_map(user, org).keys())


def visible_project_ids(user, org=None):
    """Project ids with ≥1 visible sub-project."""
    sp_ids = visible_subproject_ids(user, org)
    if not sp_ids:
        return []
    from projects.models import SubProject
    return list(
        SubProject.objects.filter(id__in=sp_ids)
        .values_list("project_id", flat=True)
        .distinct()
    )


def level_for_subproject(user, subproject_id, org=None):
    """The user's effective level on one sub-project, or None if not visible."""
    info = access_map(user, org).get(subproject_id)
    return info["level"] if info else None


def can_act_as_member(user, subproject_id, org=None):
    """True if the user may create/edit (Member) in this sub-project. Scoped via
    access_map, so an admin can only act inside their OWN org (the sub-project must
    be in scope) — not on another org's sub-project by id."""
    info = access_map(user, org).get(subproject_id)
    if info is None:
        return False
    return is_org_admin(user, org) or info["level"] == LEVEL_MEMBER


def excluded_targets(user, org=None, *, group_ids=None, tier_id=None):
    """Resolve the user's effective exclusions into id sets by kind.

    Returns {"tasks", "subprojects", "projects", "users", "groups"} of ids. Admins
    are never excluded from anything.
    """
    empty = {"tasks": set(), "subprojects": set(), "projects": set(), "users": set(), "groups": set()}
    if not (user and user.is_authenticated) or is_org_admin(user, org):
        return empty
    if group_ids is None or tier_id is None:
        gids, tid = _subject_ids(user, org)
        group_ids = gids if group_ids is None else group_ids
        tier_id = tid if tier_id is None else tier_id

    rows = Exclusion.objects.filter(_subject_q(user, group_ids, tier_id)).values(
        "excluded_task_id", "excluded_subproject_id", "excluded_project_id",
        "excluded_user_id", "excluded_group_id",
    )
    out = {"tasks": set(), "subprojects": set(), "projects": set(), "users": set(), "groups": set()}
    for r in rows:
        if r["excluded_task_id"]:
            out["tasks"].add(r["excluded_task_id"])
        if r["excluded_subproject_id"]:
            out["subprojects"].add(r["excluded_subproject_id"])
        if r["excluded_project_id"]:
            out["projects"].add(r["excluded_project_id"])
        if r["excluded_user_id"]:
            out["users"].add(r["excluded_user_id"])
        if r["excluded_group_id"]:
            out["groups"].add(r["excluded_group_id"])
    return out


def _subject_q(user, group_ids, tier_id):
    """Q matching rows whose subject is this user, any of their groups, or their tier."""
    q = Q(user_id=user.id) | Q(group_id__in=group_ids)
    if tier_id:
        q |= Q(tier_id=tier_id)
    return q


def visible_tasks_q(user, org=None, prefix=""):
    """A Q selecting exactly the Task rows the user may see.

    `prefix` adapts the field lookups for related querysets (e.g. "task__" when
    filtering Comments/Subtasks). Apply to a queryset and call .distinct() — the
    "own"/exclusion clauses join the assignee M2Ms. Admins → Q() (everything in
    the org context).
    """
    # Isolation gate first: outside this org (non-superuser) → nothing.
    if org is not None and not _in_org(user, org):
        return Q(pk__in=[])

    if is_org_admin(user, org):
        if org is None:
            return Q()  # legacy global admin → everything
        return Q(**{f"{prefix}subproject__project__organization": org})

    group_ids, tier_id = _subject_ids(user, org)
    amap = access_map(user, org)
    if not amap:
        return Q(pk__in=[])  # no access → nothing

    def f(lookup):
        return f"{prefix}{lookup}"

    all_sps = [sp for sp, info in amap.items() if info["sees"] in (SEES_SUBPROJECT, SEES_PROJECT)]
    own_sps = [sp for sp, info in amap.items() if info["sees"] == SEES_OWN]

    allow = Q()
    if all_sps:
        allow |= Q(**{f("subproject_id__in"): all_sps})
    if own_sps:
        mine = Q(**{f("assignees__id"): user.id})
        if group_ids:
            mine |= Q(**{f("assignee_groups__id__in"): group_ids})
        allow |= Q(**{f("subproject_id__in"): own_sps}) & mine
    if not allow:
        return Q(pk__in=[])

    # Deny wins over everything (including assignment). Build the set of denied
    # task pks as an explicit subquery and exclude by pk — this is the only form
    # that is unambiguous for the assignee/group M2Ms (a plain ~Q(assignees__in=…)
    # in a combined filter would leak tasks merely co-assigned to an excluded user).
    exc = excluded_targets(user, org, group_ids=group_ids, tier_id=tier_id)
    deny_cond = Q()
    if exc["tasks"]:
        deny_cond |= Q(id__in=exc["tasks"])
    if exc["subprojects"]:  # (also pruned from amap, kept here for safety)
        deny_cond |= Q(subproject_id__in=exc["subprojects"])
    if exc["projects"]:
        deny_cond |= Q(subproject__project_id__in=exc["projects"])
    if exc["users"]:
        deny_cond |= Q(assignees__id__in=exc["users"])
    if exc["groups"]:
        deny_cond |= Q(assignee_groups__id__in=exc["groups"])
    if deny_cond:
        from tasks.models import Task
        denied_pks = Task.objects.filter(deny_cond).values("pk")
        return allow & ~Q(**{f("pk__in"): denied_pks})

    return allow


def filter_visible_tasks(qs, user, org=None, prefix=""):
    """Apply visible_tasks_q to a Task (or task-related) queryset, de-duplicated."""
    return qs.filter(visible_tasks_q(user, org, prefix=prefix)).distinct()


def can_see_task(user, task, org=None):
    """Whether the user may see one specific task (respects own + exclusions)."""
    if is_org_admin(user, org) and (org is None or _in_org(user, org)):
        return True
    from tasks.models import Task
    return Task.objects.filter(visible_tasks_q(user, org)).filter(pk=task.pk).exists()
