# Share Preview Cards — Build Plan

**Feature:** When a Project / Sub-Project / Task / Sub-Task is shared to Slack,
WhatsApp, iMessage, Discord, Telegram, etc., the pasted link unfurls into a rich
preview card (name · priority · status · assignee · breadcrumb · description),
matching the text-card portion of Jira's Slack unfurl.

**Date:** 2026-06-29 · **Complexity:** Medium (~1 day) · **Status:** plan / awaiting approval

## Locked decisions (Brainstorm)
1. **Reach:** everywhere via Open Graph meta tags. NO Slack-app interactive buttons.
2. **Description:** on by default (with a per-share toggle).
3. **Lifetime:** links live forever (no auto-expiry).
4. **Freshness:** LIVE — card reflects the item's current state on every fetch.
5. **Card fields:** FULL — name · priority chip · status badge · assignee · Project▸Sub-Project breadcrumb · 1–2 line description excerpt.
6. **Revoke:** yes — a "Revoke link" control kills a specific link.
7. **Token scope:** bearer link, card-only. Click-through still requires login + normal permissions.

## Mechanism (the one universal trick)
Every chat platform unfurls a pasted URL by fetching the page and reading
`og:title` / `og:description` / `og:image`. One server-rendered share route +
one card-image endpoint covers all platforms with zero per-platform OAuth.
WhatsApp supports ONLY this (no bot/app integration), so OG tags are the correct
common denominator.

Obstacle: a real Taskboard URL is auth-gated, so the unfurl bot can't read it.
Fix: a public, unguessable **share token** route that exposes only card metadata.

## Architecture

### New Django app: `sharing/`
**Model `ShareLink`** (one stable link per shared object; re-sharing returns the same link):
- `token` — `secrets.token_urlsafe(16)` (~22 chars), unique, indexed. Bearer secret.
- GenericForeignKey → Project | SubProject | Task | SubTask (`content_type` + `object_id`).
- `organization` (FK, denormalized for scoping/cleanup).
- `created_by`, `created_at`.
- `revoked_at` (nullable) — set on revoke; revoked links return 410.
- `include_description` (bool, default True) — honors decision #2 + toggle.
- Manager `for_object(obj, user)` → `get_or_create` so one object = one durable link.

### Routes
Public (server-rendered HTML/PNG, NOT under `/api/`, must be excluded from the SPA catch-all):
- `GET /s/<token>` → branded landing page. `<head>` carries OG + Twitter meta.
  Body = the card preview + "Open in Taskboard" button → app deep link
  (`/app/.../<id>`), which requires login. Revoked/missing → 410 page (no meta).
- `GET /s/<token>/card.png` → the generated card image (referenced by `og:image`).

API (under `/api/`, for the SPA, auth required):
- `POST /api/share` — body `{type, id}` → permission-checked → returns `{token, url, include_description}`.
- `PATCH /api/share/<token>` — toggle `include_description`.
- `POST /api/share/<token>/revoke` — sets `revoked_at`.
- (`GET /api/share?type=&id=` optional — fetch existing link for an item.)

`config/urls.py`: add `path("s/<token>", ...)` + `path("s/<token>/card.png", ...)`
BEFORE the SPA catch-all, and extend the catch-all negative-lookahead to
`^(?!api/|admin/|s/)`.

### Card image rendering — `sharing/card.py`
**Primary: Pillow + bundled brand TTFs.** Pillow/FreeType reads bundled `.ttf`
files directly regardless of host fonts → deterministic on Render (no fontconfig
roulette, no headless-Chrome memory cost). Layout is simple (text + rounded
priority/status chips + breadcrumb), well within Pillow.
- Bundle `Instrument Sans` (title/UI) + `Red Hat Mono` (IDs/numbers) into
  `sharing/fonts/`. (Fraunces NOT used — wordmark only, per brand rules.)
- Brand tokens pulled from `docs/design-system.md` / DESIGN-DECISIONS-LOG:
  status colors (To Do gray · In Progress blue · Delayed red · Review #7a5aa6 ·
  Done green), priority palette, navy `#1e3a6e`, cream surface.
- Size 1200×630 (the og:image standard `summary_large_image`).
- LIVE data each render; `Cache-Control` + `ETag` keyed off `obj.updated_at` so
  edits bust the bot's cache but repeat fetches are cheap.
- *(Alternative noted for later: SVG→PNG via `resvg` for fancier typography/
  gradients — deferred; Pillow is the robust baseline.)*

### OG meta emitted by `/s/<token>`
- `og:title` → `"[High] Mobile Hot Bar"` (priority + name; priority omitted if N/A)
- `og:description` → `"In Progress · Marketing ▸ Campaigns · Assignee: Osama — <excerpt>"`
  (description excerpt only if `include_description`)
- `og:image` → `<origin>/s/<token>/card.png` · `twitter:card=summary_large_image`
- `og:url`, `og:type=website`, `og:site_name="Ananda Taskboard"`

### Frontend
- `api/share.ts` — thin client (create/get/toggle/revoke).
- `ShareButton` + `SharePopover` — line-art share icon (NO emoji, per
  constitution); popover shows the link, **Copy**, **native share sheet**
  (`navigator.share` on mobile), a **description on/off** toggle, and **Revoke**.
  Built on the existing popover/`SingleSelect` patterns; light + dark.
- Wire into all four surfaces: Task detail panel, Sub-Task row, Project menu,
  Sub-Project menu — reuse existing row-action menus (no new layout invented).
- i18n keys added to ALL 13 locales (parity test enforces).

### Permissions / security
- Mint link only if the requester can view the item (server-side, via the
  existing `permissions` app — never trust the client).
- Token is card-only bearer; deep-link click-through hits normal auth + perms.
- 410 on revoked/missing. No enumeration (random token, constant-time lookup).
- Description excerpt truncated server-side; toggle lets the sharer suppress it.

## Build order
1. `sharing` app scaffold + `ShareLink` model + migration.
2. Card renderer (`card.py`) + bundle fonts; unit-test PNG output.
3. Public `/s/<token>` view (OG head + landing) + `card.png` view; wire `config/urls.py`.
4. API endpoints (create/get/toggle/revoke) + permission checks + serializers.
5. Frontend `ShareButton`/`SharePopover` + API client + wire 4 surfaces + i18n.
6. Tests (below) → Fallow/lint/type → CodeRabbit → security-review → live verify.

## Tests
- Token unique + unguessable; one durable link per object (get_or_create).
- OG tags correct per entity type (Project/SubProject/Task/SubTask).
- `include_description` toggle reflected in description + excerpt.
- Revoked link → 410 (both `/s/<token>` and `card.png`).
- `card.png` returns image/png bytes; renders with missing assignee / no
  description / very long title / each status + priority.
- Permission: user without item access gets 403 on `POST /api/share`.
- SPA catch-all still excludes `/s/` (regression).

## States to design (card + popover)
Card: each of 5 statuses, each priority, no-assignee, multi-assignee (+N), long
title (ellipsis), no-description, Project vs Sub-Project vs Task vs Sub-Task.
Popover: default, copied-confirmation, description-off, revoked, loading, error;
light + dark; mobile (native share sheet) + desktop.

## Deploy notes
- ⚠️ Taskboard deploy gotcha: after any `frontend/src` change, `npm run build`
  + commit `frontend/dist` before pushing `main`.
- New backend deps: Pillow (already likely present for attachments — verify).
- Bundle fonts committed under `backend/sharing/fonts/`.
- Smoke-test post-deploy: paste a real share link into Slack + WhatsApp and
  confirm the unfurl; hit `card.png` directly; verify 410 on a revoked link.

## Out of scope (deferred)
- Slack App with interactive buttons (Comment / More actions) — Slack-only,
  large (OAuth install, Block Kit, interactivity server, app review). Can layer
  on the same data later.
- Paid/Stripe, snapshot mode, per-share expiry.
