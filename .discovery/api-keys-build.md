---
project: ananda-taskboard-api-keys
status: in-progress
started: 2026-07-05
owner: Claude (autonomous overnight build for Gordon)
---

# API Keys for AI Access — Build Doc

## Goal (Gordon, 2026-07-05)
Give AIs (Claude, etc.) programmatic access to a person's Organization via API
keys, with toggleable permission scopes (read / read-write). Built autonomously
overnight; Gordon asleep, "get as far as you can on your own."

## Autonomous design decisions (Gordon vetoes rather than specifies)

1. **New Django app `apikeys/`** — mirrors the app-per-domain convention;
   isolates a security-sensitive surface. Model blueprint = `sharing/ShareLink`
   (org-scoped bearer token, "treat as an API key").

2. **Scopes: two, not three.** `read` (Read only) and `read_write` (Read &
   write). Gordon said "read, write, read and write, etc — as you see fit."
   Write-only is **deliberately omitted**: it's a footgun (you can't create a
   task without reading its project/sub-project first) and no major service
   ships it usefully. Two clean scopes = "like most services" (GitHub
   fine-grained PATs, Stripe restricted keys). 🟦 OPEN Q for Gordon: want a
   third write-only scope anyway, or per-resource granularity later?

3. **Key acts AS its creator, bounded by their access.** A key can never
   exceed the visibility/edit rights of the admin who created it — the existing
   `permissions/engine.py` gates everything on `request.user` + `request.org`.
   Org comes from the KEY, not the `X-Org-Id` header (anti-spoofing).

4. **Key creation/management gated to org Admins/Owners** (`IsAdmin`).
   Programmatic org access is a sensitive capability = least privilege.

5. **Key MANAGEMENT endpoints require a real JWT session** (not an API key).
   An API key — even read_write — cannot mint or revoke other keys. Prevents
   privilege escalation. (`ApiKeyViewSet.authentication_classes = [JWT]`.)

6. **Scope enforced at the AUTHENTICATION layer** (not only a permission
   class): a read-only key on any unsafe method → 403, globally, regardless of
   per-view `permission_classes` overrides. Belt-and-suspenders permission
   class added to DRF defaults too.

7. **Secret shown ONCE** on create; stored as SHA-256 hash (high-entropy token
   → fast hash is correct; bcrypt's 72-byte limit/slowness is for passwords).
   Format `atb_<43 url-safe chars>`; display prefix `atb_ + 8 chars`.

## Key format
`atb_` + `secrets.token_urlsafe(32)`  (~47 chars total)
- `prefix` (stored, indexed, shown): first 12 chars, e.g. `atb_a1b2c3d4`
- `hashed_key` (stored, unique): `sha256(full_key).hexdigest()`
- Lookup: `filter(hashed_key=sha256(incoming))` — O(1), no raw secret at rest.

## How an AI uses it
```
GET https://ananda-taskboard.onrender.com/api/tasks
Authorization: Bearer atb_xxxxxxxx…        # or:  X-Api-Key: atb_xxxx…
```
No `X-Org-Id` needed — the key carries its org. Read-only key → writes 403.

## Files
Backend (`backend/apikeys/`): models · authentication · permissions ·
serializers · views · urls · admin · migrations · test_apikeys.
Settings: INSTALLED_APPS += apikeys; DEFAULT_AUTHENTICATION_CLASSES prepend
ApiKeyAuthentication; DEFAULT_PERMISSION_CLASSES += ApiKeyScopePermission.
Root urls: include apikeys.urls.
Frontend: Settings → "API Keys" section (admin-only) + TanStack Query hooks.
Docs: api-reference.md, permissions-matrix.md.

## Progress
- [x] Backend design validated against real code (2 Explore agents)
- [x] Backend build — apikeys app (model/auth/permission/serializers/views/urls/admin), wired into settings + root urls, migration 0001 applied, `manage.py check` clean
- [x] Backend tests — apikeys/test_apikeys.py, 16 pass (auth via 3 headers, org-from-key anti-spoof, acts-as-creator scoping, invalid/revoked/expired 401, read-only write-block 403, read_write allow, admin-gate, cross-org IDOR 404, JWT-only management, reveal-once)
- [~] Full backend suite re-run (guarding the new global auth/permission classes) — running
- [~] Frontend Settings UI — delegated to Sonnet agent (new ApiKeys.tsx pane + Settings wiring + 13 locales)
- [x] Docs — api-reference.md + permissions-matrix.md updated
- [ ] QA + security review + CodeRabbit
- [ ] Deploy (build frontend/dist, commit, push) — staged; PUSH left for Gordon

## Files built (backend)
- backend/apikeys/{__init__,apps,models,authentication,permissions,serializers,views,urls,admin,test_apikeys}.py
- backend/apikeys/migrations/0001_initial.py
- backend/config/settings.py (INSTALLED_APPS, DEFAULT_AUTHENTICATION_CLASSES, DEFAULT_PERMISSION_CLASSES)
- backend/config/urls.py (include apikeys.urls)

## Deploy note
Per project CLAUDE.md the deploy gotcha: must `npm run build` + commit
`frontend/dist` + push main. I will build+commit locally and verify tests, but
🟪 leave the PUSH/deploy decision to Gordon unless clearly safe — a new auth
surface on production warrants a human nod. Will stage everything ready.
