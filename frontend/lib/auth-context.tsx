"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  user_id: number;
  email: string;
  name: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

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
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
