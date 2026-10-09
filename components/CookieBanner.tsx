'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from './LocaleProvider';
import { cookieNoticeSeen, markCookieNoticeSeen } from '@/lib/cookie-consent';

/** One-time notice about the single essential cookie (same look as drmahermahmoud.com's banner). */
export default function CookieBanner() {
  const { t, href } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (cookieNoticeSeen()) return;
    const timer = setTimeout(() => setShow(true), 700);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="cookie-banner" role="region" aria-label={t.cookies.label}>
      <div className="cookie-content">
        <div className="cookie-text">
          <h3>{t.cookies.title}</h3>
          <p>{t.cookies.text}</p>
        </div>
        <div className="cookie-actions">
          <Link href={href('/privacy')} className="cookie-link">
            {t.legal.privacy}
          </Link>
          <button
            type="button"
            className="cookie-button"
            onClick={() => {
              markCookieNoticeSeen();
              setShow(false);
            }}
          >
            {t.cookies.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
