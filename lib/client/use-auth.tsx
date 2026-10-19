'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Locale } from '../i18n';
import type { PatientInfo } from '../auth';

/**
 * Who is signed in. Signing in happens on the clinic website
 * (drmahermahmoud.com) — the Dr. Maher network sign-in shared by the clinic
 * site, BossMen Clinics and SkinScan. On a computer it opens in a pop-up
 * window that closes itself when done (/auth/done); on phones the whole page
 * goes there and comes back. The clinic's session cookie is shared with
 * SkinScan's subdomain, so a patient already signed in there is signed in
 * here too.
 */

/** The pop-up tells this page it has finished (postMessage and BroadcastChannel). */
export const SIGNIN_MESSAGE = 'skinscan-signin';

/** Where the pop-up lands after signing in. */
export const DONE_PATH = '/auth/done';

type Kind = 'login' | 'register';

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
  /** Sign in (or create an account) on the clinic website. */
  signIn: (kind: Kind, locale: Locale) => void;
  /** The sign-in window is open and we are waiting for it. */
  waiting: boolean;
  /** Calls back when a sign-in through the pop-up should continue the scan; returns an unsubscribe function. */
  onResume: (callback: () => void) => () => void;
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

function clinicSignInUrl(kind: Kind, locale: Locale, next: string) {
  return `${clinicLink(kind === 'register' ? '/register' : '/login', locale)}?next=${encodeURIComponent(next)}`;
}

type Me = { patient: PatientInfo | null; required: boolean; unavailable: boolean } | null;

/** Who the server says is signed in (null: it could not be asked). */
async function readMe(): Promise<Me> {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
    const data = (await response.json()) as {
      authenticated?: boolean;
      required?: boolean;
      unavailable?: boolean;
      patient?: PatientInfo;
    };
    return {
      patient: data.authenticated && data.patient ? data.patient : null,
      required: data.required !== false,
      unavailable: !!data.unavailable,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [prompt, setPrompt] = useState({ open: false, resumeScan: false });
  const [waiting, setWaiting] = useState(false);
  const popup = useRef<Window | null>(null);
  const promptRef = useRef(prompt);
  const resumers = useRef(new Set<() => void>());
  const ready = useRef<{ state: { allowed: boolean } | null; waiters: Set<(state: { allowed: boolean }) => void> }>({
    state: null,
    waiters: new Set(),
  });

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  /** Shows what the server said; returns whether the patient is signed in. */
  const apply = useCallback((me: Me) => {
    setPatient(me?.patient ?? null);
    if (me) {
      setRequired(me.required);
      setUnavailable(me.unavailable);
    }
    setLoading(false);
    ready.current.state = { allowed: !!me && (!!me.patient || !me.required) };
    const { state, waiters } = ready.current;
    waiters.forEach((w) => w(state));
    waiters.clear();
    return !!me?.patient;
  }, []);

  useEffect(() => {
    let ignore = false;
    void readMe().then((me) => {
      if (!ignore) apply(me);
    });
    return () => {
      ignore = true;
    };
  }, [apply]);

  /** Back from the clinic's sign-in window. */
  const finished = useCallback(async () => {
    popup.current = null;
    setWaiting(false);
    const signedIn = apply(await readMe());
    if (!signedIn) return;
    const resume = promptRef.current.resumeScan;
    setPrompt({ open: false, resumeScan: false });
    if (resume) resumers.current.forEach((callback) => callback());
  }, [apply]);

  // The pop-up reports back from /auth/done.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== SIGNIN_MESSAGE) return;
      void finished();
    };
    window.addEventListener('message', onMessage);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SIGNIN_MESSAGE);
      channel.onmessage = (event) =>
        onMessage(new MessageEvent('message', { data: event.data, origin: window.location.origin }));
    } catch {
      // Older browsers: postMessage only.
    }

    return () => {
      window.removeEventListener('message', onMessage);
      channel?.close();
    };
  }, [finished]);

  // Closed by hand before finishing: stop waiting (and see whether it worked anyway).
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      if (popup.current?.closed) void finished();
    }, 600);
    return () => window.clearInterval(timer);
  }, [waiting, finished]);

  const signIn = useCallback((kind: Kind, locale: Locale) => {
    const resumeScan = promptRef.current.resumeScan;
    const wholePage = () => {
      window.location.href = clinicSignInUrl(kind, locale, returnUrl(resumeScan));
    };

    // Phones open "pop-ups" as new tabs that can't always close themselves,
    // so there the whole page goes and comes back.
    if (window.matchMedia('(max-width: 900px), (pointer: coarse)').matches) {
      wholePage();
      return;
    }

    const width = 480;
    const height = 720;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const opened = window.open(
      clinicSignInUrl(kind, locale, `${window.location.origin}${DONE_PATH}`),
      'drmaher-signin',
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );

    if (!opened) {
      wholePage();
      return;
    }

    opened.focus();
    popup.current = opened;
    setWaiting(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setPatient(null);
    }
  }, []);

  const openSignIn = useCallback((resumeScan = false) => setPrompt({ open: true, resumeScan }), []);
  const closeSignIn = useCallback(() => {
    popup.current?.close();
    popup.current = null;
    setWaiting(false);
    setPrompt({ open: false, resumeScan: false });
  }, []);

  const onResume = useCallback((callback: () => void) => {
    const current = resumers.current;
    current.add(callback);
    return () => {
      current.delete(callback);
    };
  }, []);

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
        signIn,
        waiting,
        onResume,
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
