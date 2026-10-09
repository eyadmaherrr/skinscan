/**
 * SkinScan sets no optional cookies (no analytics, advertising or tracking);
 * the only cookie is the clinic sign-in. The notice is shown once and the
 * acknowledgement is remembered in this browser only.
 */

const NOTICE_KEY = 'dma_cookie_notice';

export function cookieNoticeSeen(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === 'seen';
  } catch {
    return false;
  }
}

export function markCookieNoticeSeen(): void {
  try {
    localStorage.setItem(NOTICE_KEY, 'seen');
  } catch {
    // Storage blocked: the notice simply shows again next time.
  }
}
