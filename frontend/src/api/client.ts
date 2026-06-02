// Thin API client: JWT access token in memory, refresh token in localStorage,
// transparent refresh-on-401. All calls go through /api (Vite proxies to Django).

let accessToken: string | null = null;
const REFRESH_KEY = "atb_refresh";

export function setTokens(access: string | null, refresh?: string | null) {
  accessToken = access;
  if (refresh !== undefined) {
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    else localStorage.removeItem(REFRESH_KEY);
  }
}
export function getRefresh(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}
export function isLoggedIn(): boolean {
  return !!accessToken || !!getRefresh();
}

async function refreshAccess(): Promise<boolean> {
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
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
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
  post: (p: string, b?: unknown) => raw("POST", p, b ?? {}).then(handle),
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
  logout() {
    setTokens(null, null);
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
