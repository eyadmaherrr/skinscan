/**
 * Maintenance mode, shared with drmahermahmoud.com: the clinic's admin
 * panel switches its `site_locked` setting, which the clinic website
 * publishes at /api/site/status. The proxy (proxy.ts) sends SkinScan's
 * visitors to /503 while it is on.
 *
 * Same caching as the clinic website (its lib/siteLock.ts), so both sites
 * switch together — within about 10 s, never more than 30 s:
 * - answer younger than ttlMs:       used as is;
 * - younger than maxStaleMs:         used, refreshed in the background;
 * - older (or none yet):             the request waits for a fresh answer.
 * Prefetches never wait. Failed checks fail open (not locked).
 */

interface LockState {
  locked: boolean;
  checkedAt: number;
}

interface SiteLockOptions {
  /** Resolves to the current lock flag; rejects if it can't be read. */
  fetchLocked: () => Promise<boolean>;
  ttlMs: number;
  maxStaleMs: number;
  now?: () => number;
}

interface LockCheck {
  prefetch: boolean;
  /** Keeps a background refresh alive after the response is sent. */
  waitUntil: (promise: Promise<unknown>) => void;
}

export function createSiteLockCache({ fetchLocked, ttlMs, maxStaleMs, now = Date.now }: SiteLockOptions) {
  let state: LockState | null = null;
  let refreshing: Promise<LockState | null> | null = null;

  function refresh() {
    refreshing ??= fetchLocked()
      .then((locked) => {
        state = { locked, checkedAt: now() };
        return state;
      })
      .catch((error) => {
        console.error(JSON.stringify({ event: 'site_lock', outcome: 'check_failed', message: String(error) }));
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  async function isLocked({ prefetch, waitUntil }: LockCheck): Promise<boolean> {
    const age = state ? now() - state.checkedAt : Infinity;
    if (state && age < ttlMs) return state.locked;

    // Prefetches use the last known answer; the navigation that follows is a normal request.
    if (prefetch) {
      waitUntil(refresh());
      return state?.locked ?? false;
    }
    if (state && age < maxStaleMs) {
      waitUntil(refresh());
      return state.locked;
    }
    return (await refresh())?.locked ?? false;
  }

  return { isLocked };
}

/** The clinic website's answer: `{ "locked": true }` while maintenance mode is on. */
export async function fetchClinicSiteLock(clinicUrl: string): Promise<boolean> {
  const response = await fetch(`${clinicUrl}/api/site/status`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error(`status endpoint returned ${response.status}`);
  const data = (await response.json()) as { locked?: unknown };
  return data.locked === true;
}
