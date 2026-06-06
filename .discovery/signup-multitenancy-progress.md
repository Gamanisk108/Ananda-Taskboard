---
project: ananda-taskboard — signup + multi-tenancy
status: brainstorm-complete
current-round: 2
total-rounds: 2
last-updated: 2026-06-05
---

# Sign Up flow + multi-tenancy — brainstorm

Goal: let people self-serve create their own Ananda Taskboard account + team
(org). One account = global identity that can later belong to multiple orgs at
different tiers (invitations = Phase 2). Signup collects: organization name,
name, email, password, City/Country.

## Round 1 — strategic foundation (answered 2026-06-05)
- **Tenancy:** Full isolation. Each org's projects/tasks/members/tiers fully
  separate; user sees only orgs they belong to. True multi-tenant.
- **Existing data:** Migrate current projects/users into an "Ananda Los Angeles"
  org; Gordon stays its admin.
- **Org creation:** Open self-serve — anyone signs up, instantly gets their own
  org and becomes its admin.
- **Sequencing:** Phase it. Phase 1 = signup → own org + admin, org switcher,
  per-org roles/tiers, data migration. Phase 2 = email invitations + localize
  reset email.

## Round 2 — structural (answered 2026-06-05)
- **Platform owner:** Gordon = cross-org super-admin (Django `is_superuser`).
  Normal org admins manage only their own org.
- **Email verification:** Yes — signup sends a confirm link (reuses the email
  infra built for password reset); account + org activate on click.
- **City/Country:** Describes the org/center (stored on Organization).

## Settled architecture decisions (Claude, as architect)
- **Org context per request:** client stores active org id in localStorage and
  sends `X-Org-Id` header on every API call (one place in api/client.ts).
  Backend resolves `request.org` + `request.membership`, validates membership
  (403 otherwise). Stateless, multi-tab safe.
- **Admin becomes per-org:** `user.is_admin` (global) → `is_org_admin(user, org)`
  = `is_superuser OR Membership(user, org, role=admin)`. Engine functions gain an
  `org` parameter.
- **Models:** new `Organization`, `Membership(user, org, role, tier)`. `role` and
  `tier` move from User → Membership. `Project` gets `organization` FK; `Group`
  and `Tier` get `organization` FK. SubProject/Task/AccessGrant/Exclusion reach
  org via Project (no direct FK).
- **Verification reuses** Django's `default_token_generator` (same as reset):
  signup creates inactive User + inactive Org; `?verify&uid=&token=` activates.

Full build plan: see signup-multitenancy-plan.md.
