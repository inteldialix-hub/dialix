'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from './api';

// ── Types ────────────────────────────────────────────────────
interface Client {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
}

interface AuthState {
  token: string | null;
  client: Client | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, invite?: string) => Promise<void>;
  logout: () => void;
}

// ── Context ──────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

// ── Storage Keys ─────────────────────────────────────────────
const TOKEN_KEY = 'dialix_token';
const CLIENT_KEY = 'dialix_client';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// ── Provider ─────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    client: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Restore session from localStorage on mount, validate token is still valid
  useEffect(() => {
    const validateSession = async () => {
      try {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        const savedClient = localStorage.getItem(CLIENT_KEY);

        if (savedToken && savedClient) {
          if (isTokenExpired(savedToken)) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(CLIENT_KEY);
            setState(prev => ({ ...prev, isLoading: false }));
            window.location.href = '/login';
            return;
          }

          // Validate the token is still valid with a lightweight API call
          try {
            const data = await api<{ client: Client }>('/auth/me', { token: savedToken });
            setState({
              token: savedToken,
              client: data.client,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch {
            // Token expired or invalid — clear session
            // (the api() function handles the 401 redirect,
            // but in case it doesn't reach that, clear manually)
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(CLIENT_KEY);
            setState(prev => ({ ...prev, isLoading: false }));
          }
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };
    validateSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; client: Client }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(CLIENT_KEY, JSON.stringify(data.client));

    setState({
      token: data.token,
      client: data.client,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string, invite?: string) => {
    const data = await api<{ token: string; client: Client }>('/auth/register', {
      method: 'POST',
      body: { name, email, password, ...(invite ? { invite, invite_token: invite } : {}) },
    });

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(CLIENT_KEY, JSON.stringify(data.client));

    setState({
      token: data.token,
      client: data.client,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CLIENT_KEY);

    setState({
      token: null,
      client: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Redirect immediately to login page
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
