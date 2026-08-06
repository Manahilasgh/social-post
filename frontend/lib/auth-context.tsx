"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthUser {
  id: number;
  email: string;
  name: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  /** Store token in localStorage and update context. */
  login: (token: string, user: AuthUser) => void;
  /** Clear localStorage token and reset context to logged-out state. */
  logout: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = "http://localhost:8000";
const TOKEN_KEY = "auth_token";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true until initial validation completes

  // -------------------------------------------------------------------------
  // On mount: check localStorage and validate stored token with the backend
  // -------------------------------------------------------------------------
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);

    if (!stored) {
      setIsLoading(false);
      return;
    }

    // Token exists — validate it with the server
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          // 401 or any other error: token is invalid or expired — discard it
          localStorage.removeItem(TOKEN_KEY);
          return;
        }

        const data = await res.json();
        setToken(stored); // keep the original stored token; /me returns empty string
        setUser({
          id: data.user_id,
          email: data.email,
          name: data.name ?? null,
        });
      })
      .catch(() => {
        // Network error: leave the token in storage so the next load can retry,
        // but don't treat the user as authenticated for this session.
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // -------------------------------------------------------------------------
  // login — called after a successful /register or /login response
  // -------------------------------------------------------------------------
  const login = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  // -------------------------------------------------------------------------
  // logout — clears everything
  // -------------------------------------------------------------------------
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
