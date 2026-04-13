import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api.js";

interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({ user: null, loading: true, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User | null }>("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
  };

  return <AuthContext value={{ user, loading, logout }}>{children}</AuthContext>;
}

export function useAuth() {
  return useContext(AuthContext);
}
