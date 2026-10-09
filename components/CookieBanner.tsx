'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  saveCookieConsent,
  type CookieConsent,
} from '@/lib/cookie-consent';

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function reopen() {
      setShow(true);
    }

    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!readCookieConsent()) {
      timer = setTimeout(() => {
        setShow(true);
      }, 700);
    }

    return () => {
      window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function choose(consent: CookieConsent) {
    saveCookieConsent(consent);
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="cookie-banner"
      role="region"
      aria-label="Cookie preferences"
    >
      <div className="cookie-content">
        <div className="cookie-text">
          <h3>Your Privacy &amp; Cookies</h3>
          <p>
            We use essential cookies to maintain your secure patient session. We do not track you across other websites or sell your data.
          </p>
        </div>

        <div className="cookie-actions">
          <Link href="/privacy" className="cookie-link">
            Privacy Policy
          </Link>

          <button
            type="button"
            onClick={() => choose('denied')}
            className="cookie-button cookie-button-secondary"
          >
            Essential Only
          </button>

          <button
            type="button"
            onClick={() => choose('granted')}
            className="cookie-button"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
