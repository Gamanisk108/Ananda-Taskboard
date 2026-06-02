# Ananda Taskboard — Design System (Phase 3 commit)

Direction: **refined utilitarian + warmth.** A data-dense, scannable working
board (Linear/Notion DNA) softened with rounded corners and a warm, calm palette
suited to an in-house spiritual-community team. Density and legibility are
non-negotiable; warmth is the differentiator, not decoration. This is the locked
visual contract for the frontend build (step 7).

## Typography
- **Display / headings:** `Bricolage Grotesque` (warm, characterful grotesque) —
  tab labels, view titles, empty-state headlines. Weights 600/700.
- **UI / body:** `IBM Plex Sans` (humanist, highly legible at small sizes) —
  all controls, table cells, comments. Weights 400/500/600.
- **Numeric / tabular:** `IBM Plex Mono` — dates, counts, badge numbers, the
  monthly-grid figures. Use `font-variant-numeric: tabular-nums` so columns align.
- All via Google Fonts (free, Capacitor-bundleable later). NO Inter/Roboto/Arial.

## Color — warm neutrals + calm accents (light theme primary)
CSS variables (HSL-friendly hex):
```
--bg            #FAF7F2   warm off-white (paper)
--surface       #FFFFFF   cards / table surface
--surface-sunk  #F3EEE6   sunk panels, table header, hover wash
--border        #E7DFD3   warm hairline
--text          #2B2722   warm near-black
--text-muted    #6F665B   secondary text
--primary       #C8762F   warm terracotta/amber (actions, focus)
--primary-weak  #F6E7D6   primary tint (selected row, chips)
--accent        #2F7D74   calm teal (links, info)
--success       #4F7A3C   done
--warn          #B7791F   delayed
--danger        #B4452F   overdue / reject (rows flag with --danger text + tint)
```
Dark theme later (Phase B-friendly): invert to warm charcoal `#211E1A` bg,
`#EDE6DB` text, same accents — defined when needed, not built now.

## Project / Sub-project color tokens (the coding palette)
Curated 12-swatch set, all WCAG-AA legible as a chip with white/dark text.
Color-exhaustion behavior (§12): cycle the palette and append a numeric suffix
badge; never silently collide two projects to identical swatch without the suffix.
```
#C8762F #2F7D74 #4F7A3C #7A5AA6 #B4452F #2563A8
#B7791F #6B7280 #A23E6E #3F8E8E #8A6D3B #5B6CB8
```

## Shape, spacing, motion
- **Radius:** cards/panels `10px`; rows/inputs/buttons `7px`; chips/badges/pills
  `999px` (full). Soft, never sharp.
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32. Tables run TIGHT (row height ~36px,
  cell padding 8×10) to stay data-dense; chrome/padding around them stays roomy.
- **Shadows:** subtle, warm-tinted (`0 1px 2px rgba(43,39,34,.06)`,
  `0 4px 12px rgba(43,39,34,.08)` for popovers). No heavy drop shadows.
- **Motion:** restrained. One staggered reveal on first board load (rows fade/rise
  40ms apart, capped). Hover row wash, 120ms. Tab switch crossfade 100ms.
  Approval/done state changes get a brief check pulse. CSS-first; no heavy libs.

## Component notes
- **Tabs:** pill-style, underline-on-active in `--primary`; project color shown as
  a 8px dot before the label.
- **Table rows:** zebra via `--surface` / `--bg`; selected = `--primary-weak`;
  overdue = `--danger` left-border (3px) + danger-tinted date cell.
- **Badges (monthly grid):** rounded-full, project/sub-project color bg, mono
  number; overflow → "+N" pill.
- **Status:** colored dot + label (todo gray, in-progress accent, done success,
  delayed warn). Pending-approval tasks shown with a dashed border + "Pending" pill.
- **Buttons:** primary = solid terracotta; secondary = bordered warm; destructive
  = danger. All radius 7px, 500 weight.
- **Focus:** 2px `--primary` ring, offset 2px — visible, accessible.

## Accessibility
AA contrast on all text/controls; focus rings everywhere; color never the SOLE
signal (status has dot+label, overdue has border+text, not just red fill).
