'use client';

import { openCookieSettings } from '@/lib/cookie-consent';

export default function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="privacy-cookie-settings"
      onClick={openCookieSettings}
    >
      Customize Cookie Preferences
    </button>
  );
}
