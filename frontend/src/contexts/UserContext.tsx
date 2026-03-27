import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import Cookies from "js-cookie";

interface AuthUser {
  id: string;
  email: string;
  role: string;
  username: string;
}

interface UserContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!Cookies.get("access_token_js")) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/auth/get-auth-role", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* best-effort */
    }
    Cookies.remove("access_token_js");
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <UserContext.Provider value={{ user, isAuthenticated: !!user, isLoading, refresh, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  return useContext(UserContext);
}
