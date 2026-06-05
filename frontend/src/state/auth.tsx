import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getActiveOrg, isLoggedIn, setActiveOrg } from "../api/client";
import type { Me } from "../types";

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchOrg: (orgId: number) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      let data = (await api.get("/api/me")) as Me;
      // Ensure an active org is selected; default to the first membership and
      // re-fetch so the tree/groups come back scoped to that org.
      const orgs = data.memberships ?? [];
      const current = getActiveOrg();
      const valid = current && orgs.some((o) => String(o.org_id) === current);
      if (!valid && orgs.length) {
        setActiveOrg(orgs[0].org_id);
        data = (await api.get("/api/me")) as Me;
      }
      setMe(data);
    } catch {
      setMe(null);
    }
  }

  useEffect(() => {
    (async () => {
      if (isLoggedIn()) await refreshMe();
      setLoading(false);
    })();
  }, []);

  const value: AuthCtx = {
    me,
    loading,
    refreshMe,
    async login(email, password) {
      await api.login(email, password);
      await refreshMe();
    },
    logout() {
      api.logout();
      setMe(null);
    },
    async switchOrg(orgId) {
      setActiveOrg(orgId);
      await refreshMe();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}
