"use client";

<<<<<<< HEAD
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
=======
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
>>>>>>> main

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

<<<<<<< HEAD
interface User {
  user_id: number;
  email: string;
  name: string;
=======
interface AuthUser {
  id: number;
  email: string;
  name: string | null;
>>>>>>> main
}

interface AuthState {
  token: string | null;
<<<<<<< HEAD
  user: User | null;
=======
  user: AuthUser | null;
>>>>>>> main
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
<<<<<<< HEAD
  login: (token: string, user: User) => void;
=======
  /** Store token in localStorage and update context. */
  login: (token: string, user: AuthUser) => void;
  /** Clear localStorage token and reset context to logged-out state. */
>>>>>>> main
  logout: () => void;
}

// ---------------------------------------------------------------------------
<<<<<<< HEAD
=======
// Constants
// ---------------------------------------------------------------------------

const API_BASE = "http://localhost:8000";
const TOKEN_KEY = "auth_token";

// ---------------------------------------------------------------------------
>>>>>>> main
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

<<<<<<< HEAD
const TOKEN_KEY = "auth_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setState({ token: null, user: null, isLoading: false });
      return;
    }

    // Validate token with backend
    fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${storedToken}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          // Invalid token, clear it
          localStorage.removeItem(TOKEN_KEY);
          setState({ token: null, user: null, isLoading: false });
          return;
        }
        const data = await res.json();
        setState({
          token: storedToken,
          user: {
            user_id: data.user_id,
            email: data.email,
            name: data.name,
          },
          isLoading: false,
        });
      })
      .catch(() => {
        // Network error or invalid response
        localStorage.removeItem(TOKEN_KEY);
        setState({ token: null, user: null, isLoading: false });
      });
  }, []);

  const login = (token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    setState({ token, user, isLoading: false });
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setState({ token: null, user: null, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
=======
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
>>>>>>> main
      {children}
    </AuthContext.Provider>
  );
}

<<<<<<< HEAD
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
=======
// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
>>>>>>> main
}
