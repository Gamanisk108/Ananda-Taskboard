# Permissions Matrix

> Living doc. Roles: **Admin** (global), **Member** (per granted sub-project),
> **Viewer** (per granted sub-project). Effective access = union of direct +
> group grants; most-permissive wins (Member > Viewer).

| Capability | Admin | Member (granted SP) | Viewer (granted SP) |
|---|---|---|---|
| See a Project | all | if ≥1 sub-project granted | if ≥1 sub-project granted |
| See a Sub-project | all | only granted ones | only granted ones |
| Create Project / Sub-project | ✓ | ✗ | ✗ |
| Define Groups / manage grants | ✓ | ✗ | ✗ |
| Create Task | ✓ (live) | ✓ (pending* ) | ✗ |
| Edit Task content | ✓ (live) | ✓ (pending*, own visible) | ✗ |
| Change Task status | ✓ (any) | ✓ (only tasks assigned to them) | ✗ |
| Approve / reject tasks | ✓ | ✗ | ✗ |
| Comment | ✓ | ✓ (visible tasks) | ✓ (visible tasks) |
| Export (current view) | ✓ | ✓ (own visibility) | ✓ (own visibility) |
| Copy Summary | ✓ | ✓ (own visibility) | ✓ (own visibility) |
| Receive daily push | ✓ | ✓ | ✓ |

Export & Copy Summary scope-pickers (projects / sub-projects) come from the
user's permission-filtered tree, and every **person *filter*** (Export, Copy
Summary, and the List view assignee dropdown) is scoped to people sharing a
visible sub-project (`peopleInMyScope`) — reduced-access users never see the
whole roster in a filter.

The **assignment** picker (Task / Subtask editors) is deliberately *not* scoped:
it still lists everyone, greying out and tagging people who lack access to the
target sub-project, so an admin/member can knowingly assign across boundaries.
Assignment never widens what the assignee can see — visibility is governed
solely by grants (`permissions/engine.py`).

\* *Pending* unless the Sub-project has `members_post_without_approval = ON`, in
which case Member-created/edited tasks go live immediately.

## Enforcement
Every rule above is enforced **server-side** on the API, independent of UI. A
direct API call for a hidden sub-project returns **403**, not data. A Viewer
cannot create/approve/change-status via the API even if a button is exposed.

## API keys (programmatic access)
An **API key** authenticates a request as the **admin who created it**, bound to
that admin's organization. It inherits exactly that user's access — every rule
in the matrix above applies unchanged; a key can never see or do more than its
creator. Two scopes narrow it further: `read` (GET/HEAD/OPTIONS only) and
`read_write` (full, within the creator's rights). Only Admins/Owners may create
or revoke keys, and **key management itself is not reachable via a key** (JWT
session only) — a leaked key can't escalate into more keys. See
`docs/api-reference.md` → *API keys*.
