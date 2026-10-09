'use client';

import Image from 'next/image';
import { CalendarDays, Globe, ScanFace, UserRound } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useI18n } from './LocaleProvider';
import { bookingLink, clinicLink, useAuth } from '@/lib/client/use-auth';
import { localePath, stripLocale, type Locale } from '@/lib/i18n';

/**
 * Site navigation, built like drmahermahmoud.com's: a floating glass bar on
 * desktop (logo, links, language switch) and, on phones, a top bar with the
 * logo and language switch plus a bottom tab bar.
 */

function LanguageSwitcher() {
  const { locale, t } = useI18n();
  // Full page load: each language has its own root layout (html lang/dir).
  const switchTo = (target: Locale) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.location.href = localePath(stripLocale(window.location.pathname), target);
  };
  return (
    <div className="language-switcher" role="group" aria-label={t.nav.language}>
      <a
        href={localePath('/', 'en')}
        className={locale === 'en' ? 'language-option active' : 'language-option'}
        aria-current={locale === 'en' ? 'true' : undefined}
        lang="en"
        onClick={switchTo('en')}
      >
        EN
      </a>
      <span className="language-divider" aria-hidden="true">
        |
      </span>
      <a
        href={localePath('/', 'ar')}
        className={locale === 'ar' ? 'language-option active' : 'language-option'}
        aria-current={locale === 'ar' ? 'true' : undefined}
        lang="ar"
        onClick={switchTo('ar')}
      >
        العربية
      </a>
    </div>
  );
}

interface Props {
  /** On the scan page: return to the start of the scan instead of reloading. */
  onHome?: () => void;
  /** Highlight "Skin Scan" (the scan page); legal pages pass false. */
  scanActive?: boolean;
  /**
   * When set, every navigation link points here instead (the maintenance
   * page keeps visitors on it, as on drmahermahmoud.com's /503).
   */
  hrefOverride?: string;
}

export default function BrandHeader({ onHome, scanActive = true, hrefOverride }: Props) {
  const { t, locale, href } = useI18n();
  const { patient, loading, openSignIn } = useAuth();
  const scanHome = hrefOverride ?? href('/');
  const clinicHome = hrefOverride ?? clinicLink('/', locale);
  const booking = hrefOverride ?? bookingLink(locale);
  const accountHref = hrefOverride ?? clinicLink('/account', locale);

  const goHome = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onHome) return;
    e.preventDefault();
    onHome();
  };

  const logo = (className: string, imageSize: number, withTitle: boolean) => (
    <a href={scanHome} className={className} aria-label={t.nav.home} onClick={goHome}>
      <Image src="/brand/logo.webp" alt="" width={imageSize} height={imageSize} priority />
      {withTitle ? (
        <span className="navTitle" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <strong>{t.siteName}</strong>
          <small>{t.clinicName}</small>
        </span>
      ) : null}
    </a>
  );

  // Navigation items: Skin Scan at start, Book, Account/Sign In, and Clinic Website at the end.
  const items = (variant: 'desktop' | 'mobile') => {
    const itemClass = variant === 'desktop' ? 'desktopNavItem' : 'mobileNavItem';
    const size = variant === 'desktop' ? 19 : 22;
    const stroke = variant === 'desktop' ? 2 : undefined;
    const signedIn = !!patient || !!hrefOverride;
    return (
      <>
        <a
          href={scanHome}
          className={scanActive ? `${itemClass} active` : itemClass}
          aria-current={scanActive ? 'page' : undefined}
          onClick={goHome}
        >
          <ScanFace size={size} strokeWidth={stroke} aria-hidden />
          <span>{t.nav.scan}</span>
        </a>
        <a href={booking} className={itemClass}>
          <CalendarDays size={size} strokeWidth={stroke} aria-hidden />
          <span>{t.nav.book}</span>
        </a>
        {variant === 'desktop' && loading && !hrefOverride ? (
          <span className="desktopNavAuthLoading" aria-hidden />
        ) : signedIn ? (
          <a href={accountHref} className={itemClass}>
            <UserRound size={size} strokeWidth={stroke} aria-hidden />
            <span>{patient || !hrefOverride ? t.nav.account : t.nav.signIn}</span>
          </a>
        ) : (
          <button type="button" className={itemClass} onClick={() => openSignIn()} disabled={loading}>
            <UserRound size={size} strokeWidth={stroke} aria-hidden />
            <span>{t.nav.signIn}</span>
          </button>
        )}
        <a href={clinicHome} className={itemClass}>
          <Globe size={size} strokeWidth={stroke} aria-hidden />
          <span>{t.nav.clinicHome}</span>
        </a>
      </>
    );
  };

  return (
    <>
      <header className="desktopNav" dir="ltr">
        {logo('desktopNavLogo', 44, true)}
        <nav className="desktopNavLinks" aria-label={t.nav.navigation} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          {items('desktop')}
        </nav>
        <div className="desktopNavLanguage">
          <LanguageSwitcher />
        </div>
      </header>

      <header className="mobileAppHeader">
        {logo('mobileAppLogoLink', 40, true)}
        <div className="mobileHeaderLanguage">
          <LanguageSwitcher />
        </div>
      </header>

      <nav className="mobileBottomNav" aria-label={t.nav.navigation}>
        {items('mobile')}
      </nav>
    </>
  );
}
