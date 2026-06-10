# App Store & Play Store Readiness — Gap Analysis & Game Plan

_Last updated: 2026-06-06 · Status: research / pre-build_

## TL;DR

Ananda Taskboard is today a **Progressive Web App** (React 19 + Vite, `vite-plugin-pwa`,
service worker, VAPID web-push). It is **not yet a native app**, so it cannot be
submitted to either store as-is. The build was deliberately architected
"Capacitor-ready" (see `frontend/vite.config.ts` comment), so the path is clear —
but several **store-mandatory features are missing** regardless of wrapper:

| Mandatory item | Apple | Google | Present today? |
|---|---|---|---|
| Native wrapper (Capacitor) | ✅ required | ✅ required | ❌ Not added |
| Self-serve account deletion (in-app) | ✅ required | ✅ required | ✅ Done 2026-06-10 (Settings → Account → Delete account; POST /api/me/delete) |
| Account-deletion **web URL** | — | ✅ required | ❌ Missing |
| Privacy Policy (in-app + URL) | ✅ required | ✅ required | ✅ Done 2026-06-10 (/privacy, linked from Login + Settings) |
| Terms of Service | recommended | recommended | ✅ Done 2026-06-10 (/terms) |
| Demo account / guest access for review | ✅ required | ⚠️ recommended | ❌ Missing |
| Native push (APNs/FCM, not web-push) | ✅ if push | ✅ if push | ⚠️ Web-push only |
| App Privacy / Data Safety disclosure | ✅ required | ✅ required | ❌ Not prepared |
| App icons + splash/launch screens | ✅ required | ✅ required | ⚠️ PWA icons only |
| Payments via IAP/Play Billing (if charging) | ✅ conditional | ✅ conditional | ❌ Not built (planned) |

> **On the "guest view":** Apple's actual requirement (Guideline 2.1) is that reviewers
> can reach **full functionality** — a **working demo account** in the review notes
> satisfies this; a public guest-browsing mode is *not* strictly required. A read-only
> guest/demo mode is a nice-to-have that also de-risks review. We'll provide a seeded
> demo login at minimum.

---

## 1. The core blocker: you're a PWA, not a native app

Neither store accepts a raw website/PWA:
- **iOS:** Apple does not list PWAs in the App Store at all. You need a native binary.
  A thin webview wrapper risks rejection under **Guideline 4.2 (minimum functionality)** —
  it must feel like an app (native push, offline, native chrome, no browser UI).
- **Android:** Google technically allows a **TWA** (Trusted Web Activity) PWA wrapper,
  but to share one codebase and one process with iOS, **Capacitor** is the right call.

**Recommendation: wrap with [Capacitor](https://capacitorjs.com/).** It loads your
existing `dist/` bundle in a native shell, gives you real iOS/Android projects you can
sign and ship, and provides native plugins (push, status bar, splash, safe areas).
Zero rewrite of your React app.

---

## 2. Complete requirements checklist

### A. Packaging & distribution
- [ ] Add Capacitor + `ios/` and `android/` native projects.
- [ ] App icons (1024×1024 master → all sizes) and splash/launch screens.
- [ ] Safe-area insets (notch/Dynamic Island), status-bar styling, orientation lock or support.
- [ ] Android hardware **back-button** handling (web apps ignore it; Play reviewers test it).
- [ ] Deep-link / universal-link config (you already parse `?project/?sub/?view/?task`).
- [ ] Export-compliance flag (`ITSAppUsesNonExemptEncryption = false` if only HTTPS).
- [ ] Android **target API level** must be current (API 35+ for new apps in 2025/26).

### B. Apple App Store — hard requirements
- [ ] **2.1 — Demo account** in App Review notes (or guest mode). _Biggest review blocker._
- [ ] **5.1.1(v) — In-app account deletion** (since 2022). Must be reachable from within the app.
- [ ] **5.1.1 — Privacy Policy** link in-app and in the listing.
- [ ] **App Privacy "nutrition labels"** — declare every data type collected (email, name,
      task content, push token, usage). Filled in App Store Connect.
- [ ] **4.8 — Sign in with Apple:** _Only_ required if you offer third-party/social login
      (Google/Facebook). You currently use **email + password only → NOT required.** ✅
      (If you ever add "Sign in with Google," you must also add Sign in with Apple.)
- [ ] **3.1.1 — In-App Purchase** for any digital subscription (see §3, Payments).
- [ ] Push: APNs key + "Push Notifications" capability; iOS prompts for consent (you do this).
- [ ] Support URL + marketing assets; no broken links; no beta/placeholder content.
- [ ] Age rating questionnaire.

### C. Google Play — hard requirements
- [ ] **Account deletion — in-app AND a public web URL** (Play requires both since 2024).
- [ ] **Data Safety form** — the Play equivalent of Apple's nutrition labels.
- [ ] **Privacy Policy URL** in the Play listing.
- [ ] Target API level current; 64-bit; signed App Bundle (`.aab`).
- [ ] Content rating (IARC) questionnaire.
- [ ] Play Billing for digital goods (see §3).
- [ ] Permissions declarations (push = `POST_NOTIFICATIONS` on Android 13+; you'll prompt).

### D. Shared compliance / content you must produce
- [ ] **Privacy Policy** (hosted page + in-app screen). Must list data collected, retention,
      third parties (push provider, email provider), and a deletion path.
- [ ] **Terms of Service** (recommended; required if you charge).
- [ ] **Account-deletion landing page** (Play's web URL) explaining how to delete + what's removed.
- [ ] Store listing: name, subtitle, description, keywords, screenshots (per device size),
      promo text, category, support email.

### E. Minimum-functionality / UX gaps (review risk under Apple 4.2)
- [ ] Graceful **offline** state (you have app-shell caching; add a clear "no connection" UX).
- [ ] No external "sign up on our website" dead-ends; signup must work in-app (it does ✅).
- [ ] Loading/empty/error states polished (avoid blank screens reviewers see as "broken").
- [ ] Native push wired (web-push won't fire inside the iOS wrapper — see §F).

### F. Push notifications — a real gotcha
Your current push is **VAPID web-push via a service worker** (`frontend/src/push.ts`,
`public/push-sw.js`, backend `notifications/`). **This does not work inside a Capacitor
iOS app** (no service-worker push on iOS WebView). You'll need:
- [ ] `@capacitor/push-notifications` plugin → tokens via **APNs (iOS)** and **FCM (Android)**.
- [ ] Backend `notifications/push.py` updated to send to APNs/FCM tokens (keep web-push for
      the browser PWA; add native channels for the wrapped app).
- [ ] Firebase project (FCM) + Apple APNs auth key.

---

## 3. Payments — read this before charging anything

Your roadmap (`subscription-model-plan`) is: **per-seat billing for normal orgs** vs
**self-set donations (incl. $0) for Ananda orgs.** The store rules differ sharply:

- **Commercial subscriptions (per-seat):** Both stores **require their billing**
  (Apple IAP 15–30%, Google Play Billing 15–30%) for digital access sold to users.
  You **cannot** use Stripe/external checkout for in-app digital subscriptions.
- **Nonprofit donations:** Apple (3.2.1(vi)) allows **registered nonprofits** to collect
  donations **outside IAP** (Apple Pay or approved platform); Google similarly exempts
  genuine nonprofit donations from Play Billing. The "self-set donation incl. $0" Ananda
  path likely qualifies — **but the nonprofit status must be real and documented.**

**Implication:** If launch includes paid per-seat plans, budget for IAP/Play Billing
integration (and the 15–30% cut). **Simplest path to a first launch: ship free / donation-
only, defer paid seats** — that sidesteps IAP entirely for v1. Strongly recommend this.

---

## 4. Phased game plan

### Phase 0 — Accounts & legal foundation _(Gordon, ~1–2 weeks elapsed)_
Apple Developer Program ($99/yr), Google Play Console ($25 one-time), decide legal entity
(individual vs org — org needs a D-U-N-S number), confirm Ananda's nonprofit status for the
donation path. **Blocks everything downstream — start now.**

### Phase 1 — Store-mandatory features _(Claude can build, no Mac needed)_
1. Self-serve **account deletion** — backend endpoint + confirm-modal UI + Play web URL page.
2. **Privacy Policy + Terms** — draft content + in-app screens + hosted pages.
3. **Demo/guest mode** — ✅ backend done 2026-06-10: `manage.py create_demo_account` (idempotent, viewer-grants on every project; demo@ananda.test). Optional "View demo"
   button on the login screen.
4. Polish offline/empty/error states.

### Phase 2 — Native wrapper _(Claude configures; Gordon needs a Mac for iOS builds)_
1. Add Capacitor, generate `ios/` + `android/`.
2. App icons, splash, safe areas, status bar, Android back-button.
3. Swap web-push → native push (APNs/FCM); backend multi-channel send.
4. Export-compliance + permission strings + target API levels.

### Phase 3 — Listings & disclosures _(Claude drafts; Gordon uploads/submits)_
1. Draft App Privacy + Data Safety answers (filled questionnaires).
2. Draft listing copy, keywords, screenshots (Claude can generate device screenshots via Playwright).
3. Age/content-rating answers.

### Phase 4 — Build, sign, submit _(Gordon-led, Claude assists with config)_
1. iOS: Xcode signing / cloud-Mac CI (Codemagic or EAS) if no local Mac.
2. Android: signed `.aab`.
3. Submit, respond to review feedback.

### Phase 5 (optional/deferred) — Paid seats via IAP/Play Billing
Only if v1 isn't donation-only. Adds the most work + revenue-share.

---

## 5. Division of labor

### ✅ Claude can do (in this repo, autonomously)
- Build account-deletion endpoint + UI + the Play "how to delete" web page.
- Draft Privacy Policy & Terms of Service text; build in-app screens + hosted pages.
- Build demo/guest read-only mode (seed + login button).
- Add & configure **Capacitor**, the iOS/Android projects, icons, splash, safe areas,
  status bar, back-button, deep links, export-compliance & permission strings.
- Replace web-push with **native push** plugin and update the backend sender.
- Polish offline/empty/error states for the 4.2 minimum-functionality bar.
- Draft the **App Privacy / Data Safety questionnaires** (filled, ready to transcribe).
- Generate **store screenshots** (Playwright) and draft all listing copy + keywords.
- Set up build config / CI scaffolding (Fastlane or Codemagic/EAS) for signing.
- Write/extend tests for the new logic (deletion, demo-mode permissions).

### 🧑 Gordon must do (identity, money, legal, signing)
- **Enroll** Apple Developer ($99/yr) + Google Play ($25); provide D-U-N-S if org account.
- Provide **legal/tax/banking** info and accept store agreements.
- **Final legal sign-off** on Privacy Policy & Terms (Claude drafts; a human owns the legal call).
- Confirm/document **Ananda's nonprofit status** for the donation exemption.
- Provide a **Mac** (or approve a cloud-Mac CI budget) for iOS signing & upload.
- Create the **Firebase (FCM)** project + **Apple APNs** auth key (Claude wires them in).
- Answer the **age/content-rating** questionnaires (his decisions).
- **Upload binaries & submit** for review; respond to reviewer messages.
- Decide **v1 monetization** (recommend: donation-only to avoid IAP at launch).

---

## 6. Recommended next step

Ship **Phase 1** first — account deletion, privacy/terms, demo mode — because it's
pure in-repo work that's mandatory regardless of wrapper or store, needs no developer
account, and de-risks the eventual review. Capacitor (Phase 2) follows once the Apple/Google
accounts (Phase 0) are in motion.
