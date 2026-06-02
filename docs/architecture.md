# Architecture & Data Model

> Living doc — updated as each build step lands.

## System
React 18 + Vite 5 PWA (frontend) ⇄ REST `/api` ⇄ Django + DRF (backend) ⇄ SQLite
(DB-agnostic). JWT auth. GitHub Actions cron → secured daily-push endpoint.

## Backend apps
- **accounts** — `User` (email login, global role admin|member), `Group` (named
  user collection for bulk grants).
- **projects** — `Project`, `SubProject` (unit of access; default 'General';
  `members_post_without_approval` toggle).
- **permissions** — `AccessGrant` (user XOR group → sub-project, level
  member|viewer; whole-project shortcut). The permission engine lives here.
- **tasks** — `Task`, `RecurrenceRule`, `TaskOccurrence`, `Comment`.
- **notifications** — `PushSubscription`, daily-push builder, Web Push sender,
  approval batching, group-chat summary.
- **exporting** — CSV/XLSX, permission-filtered, sanitized.
- **events** — `emit.py` event seam (webhooks later).

## Key invariants
- Every Task → exactly one SubProject → exactly one Project (no orphan path).
- Effective access = union(direct grants, group grants); most-permissive wins.
- Overviews appear only when >1 child is visible to the user.
- Server-side authorization on every endpoint (UI hiding is not security).

## ERD
_(diagram added once models are final — step 5/6)_
