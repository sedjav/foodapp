import { createContext, useContext, useEffect, useMemo, useState } from "react";

type UserRole = "ADMIN" | "USER";

type Me = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
};

type AuthContextValue = {
  token: string | null;
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const TOKEN_KEY = "foodapp.auth.token";

const AuthContext = createContext<AuthContextValue | null>(null);

const apiFetch = async (input: RequestInfo | URL, init: RequestInit = {}, token: string | null = null) => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(input, {
    ...init,
    headers
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return res;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => globalThis.localStorage?.getItem(TOKEN_KEY) ?? null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) {
        if (!cancelled) {
          setMe(null);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await apiFetch("/api/v1/me", { method: "GET" }, token);
        const data = (await res.json()) as Me;
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) {
          setToken(null);
          globalThis.localStorage?.removeItem(TOKEN_KEY);
          setMe(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await apiFetch(
      "/api/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password })
      },
      null
    );

    const data = (await res.json()) as { token: string };
    setToken(data.token);
    globalThis.localStorage?.setItem(TOKEN_KEY, data.token);
  };

  const logout = () => {
    setToken(null);
    setMe(null);
    globalThis.localStorage?.removeItem(TOKEN_KEY);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      me,
      loading,
      login,
      logout
    }),
    [token, me, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider is missing");
  return ctx;
};

export const useApi = () => {
  const { token } = useAuth();
  return {
    fetch: (input: RequestInfo | URL, init: RequestInit = {}) => apiFetch(input, init, token)
  };
};
