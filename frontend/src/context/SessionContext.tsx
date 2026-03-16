import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchSession, loginWithSession, logoutSession } from "../lib/api";
import type { SessionUser } from "../types";

type SessionContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  hasAnyPermission: (keys: string[]) => boolean;
  hasRole: (key: string) => boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const session = await fetchSession();
      setUser(session.user);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await loginWithSession(username, password);
    setUser(response.user);
  };

  const logout = async () => {
    await logoutSession();
    setUser(null);
  };

  const hasPermission = (key: string) => Boolean(key && user?.permissions?.includes(key));
  const hasAnyPermission = (keys: string[]) => (keys ?? []).some((key) => Boolean(key && user?.permissions?.includes(key)));
  const hasRole = (key: string) => {
    if (!key || !user) {
      return false;
    }
    const roleKeys = new Set([...(user.roles ?? []), user.role].filter(Boolean));
    return roleKeys.has(key);
  };

  return (
    <SessionContext.Provider value={{ user, isLoading, login, logout, refresh, hasPermission, hasAnyPermission, hasRole }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context;
}
