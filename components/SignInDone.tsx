'use client';

import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { SIGNIN_MESSAGE } from '@/lib/client/use-auth';

/**
 * Where the sign-in pop-up lands. Tells the page that opened it (by
 * postMessage, and by BroadcastChannel because Google's sign-in pages cut the
 * link to the opener) and closes. Opened without a pop-up: go home.
 */
export default function SignInDone() {
  useEffect(() => {
    const message = { type: SIGNIN_MESSAGE };

    try {
      const channel = new BroadcastChannel(SIGNIN_MESSAGE);
      channel.postMessage(message);
      channel.close();
    } catch {
      // Older browsers: postMessage below.
    }

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, window.location.origin);
    }

    window.close();

    // Still open (not a pop-up after all): continue on the site.
    const timer = window.setTimeout(() => window.location.replace('/'), 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="signin-done">
      <Loader2 className="spin" size={22} aria-hidden />
      <p>Signing you in…</p>
    </main>
  );
}
