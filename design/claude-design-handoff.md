# Ananda Taskboard — design handoff (paste into Claude)

Use this to iterate on the look in claude.ai. Two ways to use it:

- **Fast / visual:** open `design/board-mockup.html`, copy its entire contents into a
  Claude chat, and say: *"This is my app's main screen. Redesign it to be sleeker
  and more distinctive while keeping it data-dense and functional. Keep it a single
  self-contained HTML file."* Then iterate ("denser", "bolder headers", "try a dark
  variant", etc.). Paste the winning HTML back here and I'll port the styles into the
  real app.
- **Brief only:** paste the section below as context, then ask for a direction.

---

## What it is
A **data-dense, space-economical** task board for a small in-house team (the Ananda
spiritual community). It is a **working tool, not a marketing page** — every pixel
should earn its place; do not add hero sections, big empty whitespace, or decorative
filler. Screens: List (spreadsheet table), Kanban Board, Weekly + Monthly calendars,
task modal, admin panels (Team, Projects, Settings, Trash, Restore points, History).

## Users & tone
In-house team + admins; daily use, often on phones. Calm, trustworthy, a little warm
(spiritual community), but efficient and uncluttered. Not corporate-SaaS, not playful.

## Theme — "Temple of Light" (keep this palette unless exploring variants)
| Token | Value | Use |
|---|---|---|
| Nayaswami blue | `#1E3A6E` | primary buttons, key actions (the workhorse color) |
| Temple dome | `#2C5499` | links, active |
| Ivory | `#FBF6EA` | page background (never pure white) |
| Surface | `#FFFDF8` | cards / tables |
| Parchment | `#EFE5CC` | table headers, hovers, sunk panels |
| Sand | `#E3D6B8` | borders / dividers |
| Ink | `#23262B` | text (never pure black) |
| Slate | `#4A5568` | secondary text |
| Temple gold | `#C9A24B` | sacred accent — icons/badges/highlights only, used sparingly |
| Success / Warn / Danger | `#3F7D54` / `#7A5C22` / `#B4452F` | done / due-soon / overdue |

Project/sub-project coding palette (per-item dots/bars): `#C8762F #2F7D74 #4F7A3C
#7A5AA6 #B4452F #2563A8 #B7791F #6B7280 #A23E6E #3F8E8E #8A6D3B #5B6CB8`.

## Type
- **Display (headings):** Fraunces (serif, optical) — tighter tracking.
- **UI / body:** Instrument Sans.
- **Numbers / dates:** IBM Plex Mono, tabular-nums.
- Hierarchy via scale + weight (≥1.25 ratio). No Inter/Roboto.

## Hard constraints (do not violate)
1. **Space-economical + functional first.** Dense tables, tight rhythm, no bloat.
2. Mobile responsive (tables/calendars scroll; modals fill screen).
3. Color is meaning: overdue = full red row tint + red ❗ ("Missed Deadline");
   due-tomorrow = yellow tint + ❗ ("Deadline Tomorrow"); status = colored dot+label.
4. No left/right side-stripe accent borders. No gradient text. No glassmorphism.
   No giant hero-metric cards. Cards only when truly the best affordance.
5. Keep the existing information per row/cell (don't drop data to look cleaner).

## What I want from you (Claude Design)
Make it the **sleekest version possible** within the constraints: sharpen visual
hierarchy, spacing rhythm, button/tab/pill styling, table legibility, and overall
craft, and give it a distinctive (non-generic) but calm character true to the
Temple-of-Light identity. Optionally propose a tasteful dark variant. Deliver as a
single self-contained HTML file I can keep iterating on.

> The current implementation (for reference) is React + a CSS variable theme; the
> mockup HTML mirrors it 1:1 so anything you change there can be ported back.
