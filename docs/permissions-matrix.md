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
| Receive daily push | ✓ | ✓ | ✓ |

\* *Pending* unless the Sub-project has `members_post_without_approval = ON`, in
which case Member-created/edited tasks go live immediately.

## Enforcement
Every rule above is enforced **server-side** on the API, independent of UI. A
direct API call for a hidden sub-project returns **403**, not data. A Viewer
cannot create/approve/change-status via the API even if a button is exposed.
