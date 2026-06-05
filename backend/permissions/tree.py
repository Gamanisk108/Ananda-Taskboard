"""Builds the visible project → sub-project tree for /api/me, including the
overview-tab flags. Overviews appear ONLY when there's >1 thing to consolidate:
- Project Overview tab  ⇔ the user sees ≥2 sub-projects in that project.
- Global Overview tab    ⇔ the user sees ≥2 projects.
"""

from projects.models import Project, SubProject

from .engine import visible_subprojects


def visible_tree(user, org=None):
    levels = visible_subprojects(user, org)  # {subproject_id: level}
    if not levels:
        return {"projects": [], "show_global_overview": False}

    sps = (
        SubProject.objects.filter(id__in=levels.keys())
        .select_related("project")
        .order_by("project__name", "name")
    )

    by_project = {}
    for sp in sps:
        proj = by_project.setdefault(
            sp.project_id,
            {
                "id": sp.project_id,
                "name": sp.project.name,
                "color": sp.project.color,
                "subprojects": [],
                "show_project_overview": False,
            },
        )
        proj["subprojects"].append(
            {
                "id": sp.id,
                "name": sp.name,
                "color": sp.color,
                "is_default": sp.is_default,
                "level": levels[sp.id],
            }
        )

    projects = sorted(by_project.values(), key=lambda p: p["name"])
    for p in projects:
        p["show_project_overview"] = len(p["subprojects"]) >= 2

    return {
        "projects": projects,
        "show_global_overview": len(projects) >= 2,
    }
