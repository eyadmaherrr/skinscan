export type CookieConsent = 'granted' | 'denied';

export const COOKIE_CONSENT_KEY = 'dma_cookie_consent';
export const COOKIE_SETTINGS_EVENT = 'dma_open_cookie_settings';

/**
 * Reads the visitor's cookie consent preference from localStorage.
 */
export function readCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (val === 'granted' || val === 'denied') return val;
    return null;
  } catch {
    return null;
  }
}

/**
 * Persists the visitor's cookie consent choice.
 */
export function saveCookieConsent(consent: CookieConsent): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, consent);
  } catch {
    // ignore
  }
}

/**
 * Reopens the cookie settings banner from anywhere in the app (e.g. from the Privacy Policy).
 */
export function openCookieSettings(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(COOKIE_SETTINGS_EVENT));
}
