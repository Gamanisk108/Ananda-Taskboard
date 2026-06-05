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
| Export / Copy Summary | ✓ | ✓ (own visibility) | ✓ (own visibility) |
| Bulk actions | ✓ (all actions, any task) | ✓ (status/deadline only, tasks they can edit; rest skipped) | ✗ |
| Restore from Trash | ✓ (everything) | ✓ (only tasks they personally deleted) | ✓ (only tasks they personally deleted) |
| Personal settings (language / theme / own daily-push) | ✓ | ✓ | ✓ |
| App-wide settings (push schedule, timezone, statuses, events) | ✓ | ✗ | ✗ |
| Receive daily push | ✓ (per personal toggle) | ✓ (per personal toggle) | ✓ (per personal toggle) |

\* *Pending* unless the Sub-project has `members_post_without_approval = ON`, in
which case Member-created/edited tasks go live immediately.

## Reduced-access parity
Members/Viewers get the *same* capabilities admins do, **scoped to what they can
access**, never the global view:
- **Bulk actions** — Members may bulk-set status/deadline, but the server filters
  the target ids to tasks they have member-level (edit) access to via
  `can_act_as_member`; inaccessible ids are skipped and reported as `skipped`.
  Move / reassign / archive / mark-project-done stay admin-only.
- **Trash** — `Task.deleted_by` records who deleted each task; a non-admin's Trash
  lists and restores **only** their own deletions (never another user's, never
  projects/sub-projects, which only admins can delete).
- **Settings** — `PATCH /api/me` covers personal prefs (language, theme,
  `daily_push_enabled`); the org-wide `AppSettingsView` stays `IsAdmin`.

## Enforcement
Every rule above is enforced **server-side** on the API, independent of UI. A
direct API call for a hidden sub-project returns **403**, not data. A Viewer
cannot create/approve/change-status via the API even if a button is exposed.
Bulk/trash/settings scoping is likewise enforced on the API, not just hidden in
the UI.
