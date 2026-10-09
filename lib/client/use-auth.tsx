'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PatientInfo } from '../auth';

interface AuthContextValue {
  patient: PatientInfo | null;
  loading: boolean;
  authenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.patient) {
          setPatient(data.patient);
          return;
        }
      }
      setPatient(null);
    } catch (e) {
      console.warn('Auth check failed:', e);
      setPatient(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (!ignore && data.authenticated && data.patient) {
            setPatient(data.patient);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Auth check failed:', err);
      }
      if (!ignore) {
        setPatient(null);
        setLoading(false);
      }
    }
    checkAuth();
    return () => {
      ignore = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (response.ok && data.success && data.patient) {
          setPatient(data.patient);
          return { success: true };
        }
        return { success: false, error: data.error || 'Failed to sign in.' };
      } catch {
        return { success: false, error: 'Network error. Please try again.' };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setPatient(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        patient,
        loading,
        authenticated: !!patient,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
