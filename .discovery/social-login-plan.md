---
feature: social-login
scope: universal (all Ananda apps); Taskboard first
status: awaiting-credential + build
last-updated: 2026-06-13
---

# Social Login — Build Plan

Gordon (2026-06-13): Google + Facebook + Apple; allow new signups (not just
invited); approach = Identity-token verify (lightweight), not django-allauth.
"Universal across all apps" → becomes a design-constitution-level standard once
the Taskboard reference build is proven.

## 🟡 GORDON — unblock action (required before build can be verified)
Create a **Google OAuth 2.0 Client ID (Web application)** in Google Cloud Console:
- Authorized JavaScript origins: `https://ananda-taskboard.onrender.com` and
  `http://localhost:5173` (+ each app's domain later).
- No client *secret* needed for the GIS ID-token flow — the **Client ID is public**
  (safe to commit as a `VITE_GOOGLE_CLIENT_ID`); the backend verifies the token's
  audience against it.
- Give me the Client ID → I set `VITE_GOOGLE_CLIENT_ID` (frontend) +
  `GOOGLE_CLIENT_ID` (backend). Feature stays inert until set (same pattern as
  ANTHROPIC_API_KEY).
- Facebook/Apple need their own app registrations later (Apple also a private key);
  Google first.

## Backend (Google first; per-provider verifiers)
1. dep: `google-auth` (verifies the ID token: signature, issuer, audience, expiry).
2. `POST /api/auth/google {credential}` (public): verify the GIS ID token →
   `email`, `sub`, `name`, `email_verified`.
   - **Link/create:** existing user by email → log in (store `google_sub` for
     future). No account → create one (email auto-verified by Google).
   - **Signup → org:** a brand-new social user has no org. Per "allow new signups",
     return a flag so the frontend routes them to the org-create step (reuse the
     signup org-creation path); OR if they came via an invite link, accept it.
   - Issue the app's existing SimpleJWT access/refresh (same as password login).
3. Guards: reject unverified-email tokens; rate-limit; never trust client-sent
   email — only the verified token. Store provider + sub; one account per email.
4. Tests (mock the verifier): existing-email login, new-account create, bad/expired
   token 401, audience mismatch 401, email-not-verified reject.

## Frontend
1. `VITE_GOOGLE_CLIENT_ID` → render the Google button (GIS script) on **Login**,
   **Signup**, and **AcceptInvite**; hidden entirely when unset.
2. On credential callback → `POST /api/auth/google` → on success store tokens (reuse
   auth state); if `needs_org`, route to org-create; if invite context, accept.
3. "Continue with Google" styled to brand; Facebook/Apple buttons stubbed for later.

## Universal rollout
- Once proven on Taskboard: add a Design-Constitution entry ("offer social login
  where accounts exist") + a short reusable recipe (the verify endpoint + GIS button)
  other Ananda apps copy. Each app: its own Client ID + origins.

## Why this is gated, not built blind
Auth is security-critical and the live Google flow can't be verified without the
Client ID (and real Google sign-in resists headless automation). Backend logic +
frontend wiring will be built with unit tests and activate on the env var — but the
end-to-end live verification needs the credential. Build proceeds the moment the
Client ID lands.
