"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken, setToken, clearToken, getStoredEmail, setStoredEmail } from "./auth-token";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: check for stored token and validate it
  useEffect(() => {
    const storedToken = getToken();
    const storedEmail = getStoredEmail();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    // Quick optimistic load from localStorage so the UI doesn't flash
    if (storedEmail) {
      setUser({ id: "", email: storedEmail });
      setTokenState(storedToken);
    }

    // Validate token with backend
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then((data) => {
        setUser({ id: data.user_id, email: storedEmail || "" });
        setTokenState(storedToken);
      })
      .catch(() => {
        clearToken();
        setUser(null);
        setTokenState(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail || "Login failed");
    }
    const data = await res.json();
    setToken(data.access_token);
    setStoredEmail(data.user.email);
    setUser(data.user);
    setTokenState(data.access_token);
    router.push("/chat/new");
  }, [router]);

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Registration failed" }));
      throw new Error(err.detail || "Registration failed");
    }
    const data = await res.json();
    setToken(data.access_token);
    setStoredEmail(data.user.email);
    setUser(data.user);
    setTokenState(data.access_token);
    router.push("/chat/new");
  }, [router]);

  const demoLogin = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/auth/demo`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Demo login failed" }));
      throw new Error(err.detail || "Demo login failed");
    }
    const data = await res.json();
    setToken(data.access_token);
    setStoredEmail(data.user.email);
    setUser(data.user);
    setTokenState(data.access_token);
    router.push("/chat/new");
  }, [router]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setTokenState(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
