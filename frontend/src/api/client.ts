// Thin API client: JWT access token in memory, refresh token in localStorage,
// transparent refresh-on-401. All calls go through /api (Vite proxies to Django).

let accessToken: string | null = null;
const REFRESH_KEY = "atb_refresh";
const ORG_KEY = "atb_org";

/** The org id the SPA is currently scoped to (sent as X-Org-Id on every call). */
export function getActiveOrg(): string | null {
  return localStorage.getItem(ORG_KEY);
}
export function setActiveOrg(id: number | string | null) {
  if (id === null || id === undefined) localStorage.removeItem(ORG_KEY);
  else localStorage.setItem(ORG_KEY, String(id));
}

function setTokens(access: string | null, refresh?: string | null) {
  accessToken = access;
  if (refresh !== undefined) {
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    else localStorage.removeItem(REFRESH_KEY);
  }
}
function getRefresh(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}
export function isLoggedIn(): boolean {
  return !!accessToken || !!getRefresh();
}

// Single-flight: when several requests 401 at once (access token expired mid-
// session), they share ONE refresh round-trip instead of each firing their own
// (which spammed the console with refresh noise — QA 2026-06-05).
let refreshing: Promise<boolean> | null = null;

function doRefresh(): Promise<boolean> {
  return (async () => {
    const refresh = getRefresh();
    if (!refresh) return false;
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) {
      setTokens(null, null);
      return false;
    }
    const data = await res.json();
    accessToken = data.access;
    if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
    return true;
  })();
}

async function refreshAccess(): Promise<boolean> {
  if (!refreshing) refreshing = doRefresh();
  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    super(`API ${status}`);
    this.status = status;
    this.data = data;
  }
}

async function raw(method: string, path: string, body?: unknown, retry = true): Promise<Response> {
  // After a reload the access token (memory-only) is gone while the refresh
  // token persists — refresh BEFORE the call instead of letting it 401 first
  // (the 401 round-trip logged a red console error on every boot).
  if (!accessToken && getRefresh() && retry) await refreshAccess();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const org = getActiveOrg();
  if (org) headers["X-Org-Id"] = org;
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry && getRefresh()) {
    if (await refreshAccess()) return raw(method, path, body, false);
  }
  return res;
}

async function handle(res: Response) {
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (p: string) => raw("GET", p).then(handle),
  /** Authenticated GET returning the raw response text (e.g. a TSV export). */
  text: (p: string) => raw("GET", p).then((r) => r.text()),
  post: (p: string, b?: unknown) => raw("POST", p, b ?? {}).then(handle),
  /** multipart POST (FormData) — browser sets the Content-Type boundary; no JSON. */
  async postForm(p: string, form: FormData) {
    if (!accessToken && getRefresh()) await refreshAccess();
    const headers: Record<string, string> = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const org = getActiveOrg();
    if (org) headers["X-Org-Id"] = org;
    let res = await fetch(p, { method: "POST", headers, body: form });
    if (res.status === 401 && getRefresh() && (await refreshAccess())) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      res = await fetch(p, { method: "POST", headers, body: form });
    }
    return handle(res);
  },
  put: (p: string, b: unknown) => raw("PUT", p, b).then(handle),
  patch: (p: string, b: unknown) => raw("PATCH", p, b).then(handle),
  del: (p: string, b?: unknown) => raw("DELETE", p, b).then(handle),
  async login(email: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    const data = await res.json();
    setTokens(data.access, data.refresh);
    return data;
  },
  /** Social login: exchange a Google ID token for our JWTs. Returns {needs_org}. */
  async googleLogin(credential: string): Promise<{ access: string; refresh: string; needs_org: boolean; created: boolean }> {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    const data = await res.json();
    setTokens(data.access, data.refresh);
    return data;
  },
  /** Create a new org owned by the current user (e.g. after social signup). */
  createOrg(payload: { organization: string; city?: string; state?: string; country?: string }) {
    return raw("POST", "/api/orgs", payload).then(handle);
  },
  logout() {
    setTokens(null, null);
    setActiveOrg(null);
  },
  /** Self-serve signup: creates an account + a new org (inactive until verified). */
  async signup(payload: {
    organization: string; name: string; email: string; password: string; city: string; state: string; country: string;
  }) {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return res.json().catch(() => null);
  },
  /** Public, token-gated: what an invitation is for (sign-up vs join). */
  async previewInvite(id: string, token: string) {
    const res = await fetch(`/api/invitations/${id}/preview?token=${encodeURIComponent(token)}`);
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return res.json();
  },
  /** Accept an invitation. For a brand-new account the server returns tokens, so
   *  we log the user straight in and scope them to the org they joined. */
  async acceptInvite(id: string, body: { token: string; name?: string; password?: string }) {
    const res = await fetch(`/api/invitations/${id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    const data = await res.json();
    if (data.access) {
      setTokens(data.access, data.refresh);
      if (data.org_id) setActiveOrg(data.org_id);
    }
    return data;
  },
  /** Confirm an email-verification link (uid+token from the signup email). */
  async verifyEmail(uid: string, token: string) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, token }),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return res.json().catch(() => null);
  },
  /** Start a password reset. Always resolves — the server never reveals whether
   *  the email belongs to a real account. */
  async requestPasswordReset(email: string) {
    await fetch("/api/auth/password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  },
  /** Finish a password reset with the uid+token from the email link. Throws an
   *  ApiError (status 400) for an expired link or a rejected password. */
  async confirmPasswordReset(uid: string, token: string, password: string) {
    const res = await fetch("/api/auth/password/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, token, password }),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return res.json().catch(() => null);
  },
  /** Download a file from an authenticated endpoint via a blob URL. */
  async download(path: string, filename: string) {
    const res = await raw("GET", path);
    if (!res.ok) throw new ApiError(res.status, null);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
