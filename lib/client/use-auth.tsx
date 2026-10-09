'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { localePath, type Locale } from '../i18n';
import { publicConfig } from '../public-config';
import type { PatientInfo } from '../auth';

/**
 * Who is signed in. Signing in happens on the clinic website
 * (drmahermahmoud.com), which sends the patient back here afterwards; its
 * session cookie is shared with SkinScan's subdomain.
 */

interface AuthContextValue {
  patient: PatientInfo | null;
  loading: boolean;
  authenticated: boolean;
  /** Whether scanning requires a signed-in patient (server setting). */
  required: boolean;
  /** The clinic's auth service did not answer. */
  unavailable: boolean;
  logout: () => Promise<void>;
  /** The sign-in dialog; `resumeScan` continues to the photo step after signing in. */
  prompt: { open: boolean; resumeScan: boolean };
  openSignIn: (resumeScan?: boolean) => void;
  closeSignIn: () => void;
  /** Calls back once the sign-in check has finished (right away if it already has); returns an unsubscribe function. */
  whenReady: (callback: (state: { allowed: boolean }) => void) => () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

import { clinicLink, bookingLink } from '@/lib/public-config';
export { clinicLink, bookingLink };

/** Where the clinic website sends the patient after signing in: back to this page. */
function returnUrl(resumeScan: boolean): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${resumeScan ? '?scan=1' : ''}`;
}

export function signInLinks(locale: Locale, resumeScan: boolean) {
  const next = encodeURIComponent(returnUrl(resumeScan));
  return {
    google: `${publicConfig.clinicUrl}/api/auth/google?next=${next}`,
    email: `${clinicLink('/login', locale)}?next=${next}`,
    register: `${clinicLink('/register', locale)}?next=${next}`,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [prompt, setPrompt] = useState({ open: false, resumeScan: false });
  const ready = useRef<{ state: { allowed: boolean } | null; waiters: Set<(state: { allowed: boolean }) => void> }>({
    state: null,
    waiters: new Set(),
  });

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        const data = (await response.json()) as {
          authenticated?: boolean;
          required?: boolean;
          unavailable?: boolean;
          patient?: PatientInfo;
        };
        if (ignore) return;
        const signedIn = !!(data.authenticated && data.patient);
        setPatient(signedIn ? (data.patient as PatientInfo) : null);
        setRequired(data.required !== false);
        setUnavailable(!!data.unavailable);
        ready.current.state = { allowed: signedIn || data.required === false };
      } catch {
        if (ignore) return;
        setPatient(null);
        ready.current.state = { allowed: false };
      } finally {
        if (!ignore) {
          setLoading(false);
          const { state, waiters } = ready.current;
          if (state) waiters.forEach((w) => w(state));
          waiters.clear();
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setPatient(null);
    }
  }, []);

  const openSignIn = useCallback((resumeScan = false) => setPrompt({ open: true, resumeScan }), []);
  const closeSignIn = useCallback(() => setPrompt({ open: false, resumeScan: false }), []);

  const whenReady = useCallback((callback: (state: { allowed: boolean }) => void) => {
    const current = ready.current;
    if (current.state) {
      const state = current.state;
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) callback(state);
      });
      return () => {
        cancelled = true;
      };
    }
    current.waiters.add(callback);
    return () => {
      current.waiters.delete(callback);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        patient,
        loading,
        authenticated: !!patient,
        required,
        unavailable,
        logout,
        prompt,
        openSignIn,
        closeSignIn,
        whenReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
