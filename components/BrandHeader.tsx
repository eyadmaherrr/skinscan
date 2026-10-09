'use client';

import Image from 'next/image';
import { CalendarDays, LogOut, ScanFace, UserRound } from 'lucide-react';
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
}

export default function BrandHeader({ onHome, scanActive = true }: Props) {
  const { t, locale, href } = useI18n();
  const { patient, loading, logout, openSignIn } = useAuth();
  const home = href('/');

  const goHome = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onHome) return;
    e.preventDefault();
    onHome();
  };

  const logo = (className: string, imageSize: number, withTitle: boolean) => (
    <a href={home} className={className} aria-label={t.nav.home} onClick={goHome}>
      <Image src="/brand/logo.webp" alt="" width={imageSize} height={imageSize} priority />
      {withTitle ? (
        <span className="navTitle" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <strong>{t.siteName}</strong>
          <small>{t.clinicName}</small>
        </span>
      ) : null}
    </a>
  );

  const account = patient ? (
    <>
      <a href={clinicLink('/account', locale)} className="desktopNavItem" title={patient.email}>
        <UserRound size={19} strokeWidth={2} aria-hidden />
        <span>{patient.name.split(' ')[0] || t.nav.account}</span>
      </a>
      <button type="button" className="desktopNavItem iconOnly" onClick={() => logout()} title={t.nav.signOut}>
        <LogOut size={18} strokeWidth={2} aria-hidden />
        <span className="srOnly">{t.nav.signOut}</span>
      </button>
    </>
  ) : (
    <button type="button" className="desktopNavItem" onClick={() => openSignIn()}>
      <UserRound size={19} strokeWidth={2} aria-hidden />
      <span>{t.nav.signIn}</span>
    </button>
  );

  return (
    <>
      <header className="desktopNav" dir="ltr">
        {logo('desktopNavLogo', 44, true)}
        <nav className="desktopNavLinks" aria-label={t.nav.navigation} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <a
            href={home}
            className={scanActive ? 'desktopNavItem active' : 'desktopNavItem'}
            aria-current={scanActive ? 'page' : undefined}
            onClick={goHome}
          >
            <ScanFace size={19} strokeWidth={2} aria-hidden />
            <span>{t.nav.scan}</span>
          </a>
          <a href={bookingLink(locale)} className="desktopNavItem" target="_blank" rel="noopener noreferrer">
            <CalendarDays size={19} strokeWidth={2} aria-hidden />
            <span>{t.nav.book}</span>
          </a>
          {loading ? <span className="desktopNavAuthLoading" aria-hidden /> : account}
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
        <a
          href={home}
          className={scanActive ? 'mobileNavItem active' : 'mobileNavItem'}
          aria-current={scanActive ? 'page' : undefined}
          onClick={goHome}
        >
          <ScanFace size={22} aria-hidden />
          <span>{t.nav.scan}</span>
        </a>
        <a href={bookingLink(locale)} className="mobileNavItem" target="_blank" rel="noopener noreferrer">
          <CalendarDays size={22} aria-hidden />
          <span>{t.nav.book}</span>
        </a>
        {patient ? (
          <a href={clinicLink('/account', locale)} className="mobileNavItem">
            <UserRound size={22} aria-hidden />
            <span>{t.nav.account}</span>
          </a>
        ) : (
          <button type="button" className="mobileNavItem" onClick={() => openSignIn()} disabled={loading}>
            <UserRound size={22} aria-hidden />
            <span>{t.nav.signIn}</span>
          </button>
        )}
        {patient ? (
          <button type="button" className="mobileNavItem" onClick={() => logout()}>
            <LogOut size={22} aria-hidden />
            <span>{t.nav.signOut}</span>
          </button>
        ) : null}
      </nav>
    </>
  );
}
