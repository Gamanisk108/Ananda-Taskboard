"""The permission engine — ONE place that computes a user's effective access.

Every queryset, endpoint, export, push, and summary derives visibility from here.
Effective access = union of the user's direct grants + all their groups' grants;
most-permissive level wins (member > viewer). Whole-project grants expand to all
of that project's sub-projects, computed live, so newly added sub-projects are
covered automatically and group changes take effect immediately.
"""

from collections import defaultdict

from projects.models import Project, SubProject

from .models import LEVEL_MEMBER, LEVEL_RANK, AccessGrant


def visible_subprojects(user):
    """Return {subproject_id: level} the user can see.

    Admins see every sub-project at member level. A user with no grants sees {}.
    """
    if not (user and user.is_authenticated):
        return {}
    if getattr(user, "is_admin", False):
        return {sp_id: LEVEL_MEMBER for sp_id in SubProject.objects.values_list("id", flat=True)}

    group_ids = list(user.member_groups.values_list("id", flat=True))

    grants = AccessGrant.objects.filter(
        models_q(user, group_ids)
    ).values("level", "subproject_id", "project_id")

    # Map project_id -> [subproject_ids] only for projects actually granted whole,
    # to expand whole-project grants live (covers future sub-projects).
    whole_project_ids = {g["project_id"] for g in grants if g["project_id"] is not None}
    project_subprojects = defaultdict(list)
    if whole_project_ids:
        for sp_id, proj_id in SubProject.objects.filter(
            project_id__in=whole_project_ids
        ).values_list("id", "project_id"):
            project_subprojects[proj_id].append(sp_id)

    result = {}

    def _apply(sp_id, level):
        # most-permissive wins; never double-count
        if sp_id not in result or LEVEL_RANK[level] > LEVEL_RANK[result[sp_id]]:
            result[sp_id] = level

    for g in grants:
        if g["subproject_id"] is not None:
            _apply(g["subproject_id"], g["level"])
        elif g["project_id"] is not None:
            for sp_id in project_subprojects.get(g["project_id"], []):
                _apply(sp_id, g["level"])

    return result


def models_q(user, group_ids):
    """Q matching grants targeting this user directly OR any of their groups."""
    from django.db.models import Q

    return Q(user_id=user.id) | Q(group_id__in=group_ids)


def visible_subproject_ids(user):
    return list(visible_subprojects(user).keys())


def visible_project_ids(user):
    """Project ids with ≥1 visible sub-project."""
    sp_ids = visible_subproject_ids(user)
    if not sp_ids:
        return []
    return list(
        SubProject.objects.filter(id__in=sp_ids)
        .values_list("project_id", flat=True)
        .distinct()
    )


def level_for_subproject(user, subproject_id):
    """The user's effective level on one sub-project, or None if not visible."""
    return visible_subprojects(user).get(subproject_id)


def can_act_as_member(user, subproject_id):
    """True if the user may create/edit (Member) in this sub-project."""
    if getattr(user, "is_admin", False):
        return True
    return level_for_subproject(user, subproject_id) == LEVEL_MEMBER
