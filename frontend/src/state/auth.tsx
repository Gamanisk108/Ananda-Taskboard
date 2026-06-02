import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, isLoggedIn } from "../api/client";
import type { Me } from "../types";

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      const data = (await api.get("/api/me")) as Me;
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
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}
