# Claude Design Handoff — Auth, Multi-Tenancy & Invitations UI

Design these screens for **Ananda Taskboard** in two layouts each:
**(A) desktop web browser** and **(B) responsive mobile browser** (~375–430px wide).
Everything below was built and is functional; this is a *visual* redesign pass —
keep the structure/fields the same, elevate the look.

## Design system (match the existing app)
- **Background:** warm cream (`#FBF6EA`). **Primary:** deep navy (`#1E3A6E`).
  Danger red, muted gray text. Light + dark themes.
- **Auth screens** use one **centered card** on the cream background: a small brand
  row (colored dot + serif "Ananda Taskboard"), a serif H1, muted subtitle, labeled
  inputs, a full-width primary button, quiet text links below.
- **Brand:** serif wordmark "Ananda **Taskboard**" + tagline "Love & Blessings from
  Ananda Los Angeles" (in-app topbar). Rounded corners, soft shadows, generous
  spacing, scannable. Fully translated into 13 languages — keep copy short and
  label-driven; allow text to wrap/grow (German, Tamil run long).

---

## GROUP 1 — Auth & onboarding (logged-out, centered-card)

For mobile (B): the card becomes near-full-width with comfortable padding; inputs
full-width; buttons full-width; font sizes hold; vertical rhythm tightens.

1. **Login** — email + password, full-width "Sign in". Below: a "Forgot password?"
   link and a "New to Ananda Taskboard? Create an account" link.
2. **Sign Up** — title "Create your account", subtitle "Set up your team on Ananda
   Taskboard." Fields in order: **Organization name**, then **City** + **Country**
   side-by-side (stack on mobile), **Your name**, **Email**, **Password**. Full-width
   "Create account". "← Back to sign in" link. → success state: "Check your email"
   with "We've sent a verification link to {email}."
3. **Forgot Password** — "Reset your password", one email field, "Send reset link",
   "← Back to sign in". → success: "Check your email" + a quiet "contact your team
   admin" fallback line.
4. **Reset Password** (from email link) — "Choose a new password": new + confirm
   password, hint "Use at least 8 characters", "Update password". States: **success**
   ("Password updated" → Sign in) and **expired** ("This link has expired" → Request
   a new link).
5. **Verify Email** (from signup link) — three quiet states in the same card:
   **verifying…**, **verified** ("Email verified — your account and team are active"
   → Sign in), **failed** ("Verification failed" → back to sign in).
6. **Accept Invitation** (from invite link) — title "Join {Org}", subtitle "You've
   been invited to {Org} as {role} ({email})."
   - **Existing account:** just a "Join {Org}" button → then "Welcome to {Org} — sign in".
   - **New person:** name + password fields, then "Join {Org}" (logs them straight in).
   - **Invalid/expired** state: "Invitation not valid".

---

## GROUP 2 — In-app (logged-in)

7. **Org switcher** — a compact dropdown in the **topbar** (left of the action
   buttons), shown only when the user belongs to >1 org. Shows the active org name;
   selecting another switches context. **Mobile:** topbar collapses — the switcher
   should remain reachable (e.g., in the top bar or a slide-out menu), clearly
   showing "which org am I in right now".
8. **Platform overview** (superuser only) — a **modal/full-page** org directory.
   Per org: name + city/country (+ "pending verification" tag if inactive); a stat
   row (**projects / sub-projects / tasks / members** counts); the admin contacts;
   and a **member roster table** (Member · Email · Role · Tier). **Metadata only —
   never task contents.** **Mobile:** the roster table should reflow into stacked
   cards (label: value) rather than a wide table.
9. **Team panel → Invite section** (admin) — a card "Invite someone": **Email**,
   **Role** (Member/Admin), **Tier** (disabled when Admin), "Send invitation"
   button, success line "Invitation sent to {email}." Below it a **"Pending
   invitations"** list (Email · Role · Tier · Revoke). This sits above the existing
   "Add member directly" card and the member table. **Mobile:** form fields stack;
   the pending list reflows to stacked rows.

---

## GROUP 3 — Transactional emails (optional, high value)

Currently plain-text. Design simple, on-brand **HTML email templates** (single
column, ~600px, safe email CSS) for: **password reset**, **signup verification**,
and **team invitation**. Each: brand header, one short paragraph, one prominent
button (the action link), an expiry note, and an "ignore if unexpected" line.
These are already localized into 13 languages on the backend — design the *shell*;
the body text is injected.

---

## Responsive priorities (mobile B)
- One-handed reach: primary buttons full-width and near the bottom of the card.
- Tables (platform roster, pending invites, member list) → stacked label/value cards.
- Topbar: collapse actions into a menu; keep **org switcher** and **+ New task**
  reachable; never hide which org is active.
- Inputs ≥16px font (avoid iOS zoom-on-focus); generous tap targets (≥44px).
- The centered auth card: full-bleed-ish with 16–20px side padding on small screens.

## Out of scope
Don't redesign the core task list/board/calendar here — this pass is auth,
onboarding, org-switching, the platform overview, and the invite UI.
