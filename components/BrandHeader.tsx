'use client';

import Image from 'next/image';
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Globe,
  Info,
  ListChecks,
  LogIn,
  LogOut,
  Mail,
  Menu,
  ScanFace,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useI18n } from './LocaleProvider';
import { bookingLink, clinicLink, useAuth } from '@/lib/client/use-auth';
import { localePath, stripLocale, type Locale } from '@/lib/i18n';

/**
 * Site navigation, the same as drmahermahmoud.com's: a floating glass top bar
 * (brand, links, language, account) and, on phones, the brand, the account
 * button and a menu with every page, plus a bottom dock with the main links.
 */

interface Props {
  /** On the scan page: return to the start of the scan instead of reloading. */
  onHome?: () => void;
  /** Highlight "Skin Scan" (the scan page); content and legal pages pass false. */
  scanActive?: boolean;
  /**
   * When set, every navigation link points here instead (the maintenance
   * page keeps visitors on it, as on drmahermahmoud.com's /503).
   */
  hrefOverride?: string;
}

/** Full page load: each language has its own root layout (html lang/dir). */
function switchLanguage(target: Locale) {
  window.location.href = localePath(stripLocale(window.location.pathname), target);
}

export default function BrandHeader({ onHome, scanActive = true, hrefOverride }: Props) {
  const { t, locale, href } = useI18n();
  const { patient, loading, openSignIn, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const ar = locale === 'ar';
  const tr = (en: string, arabic: string) => (ar ? arabic : en);

  const to = (url: string) => hrefOverride ?? url;
  const scanHome = to(href('/'));
  const booking = to(bookingLink(locale));
  const clinicHome = to(clinicLink('/', locale));
  const accountHref = to(clinicLink('/account', locale));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Phone menu: Escape closes it, and the page behind doesn't scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('modal-open');
    };
  }, [menuOpen]);

  const goHome = (e: MouseEvent<HTMLAnchorElement>) => {
    setMenuOpen(false);
    if (!onHome || hrefOverride) return;
    e.preventDefault();
    onHome();
  };

  const closeMenu = () => setMenuOpen(false);

  const links = [
    { id: 'scan', href: scanHome, label: t.nav.scan, icon: ScanFace, active: scanActive, onClick: goHome },
    { id: 'how', href: to(href('/how-it-works')), label: t.nav.howItWorks, icon: ListChecks },
    { id: 'features', href: to(href('/features')), label: t.nav.features, icon: Sparkles },
    { id: 'book', href: booking, label: t.nav.book, icon: CalendarDays },
  ];

  // Every page, for the phone menu.
  const menu = [
    { href: to(href('/how-it-works')), label: t.nav.howItWorks, icon: ListChecks },
    { href: to(href('/features')), label: t.nav.features, icon: Sparkles },
    { href: to(href('/skin-analysis')), label: t.nav.topics, icon: BookOpen },
    { href: to(href('/about')), label: t.nav.about, icon: Info },
    { href: to(href('/contact')), label: t.nav.contact, icon: Mail },
    { href: clinicHome, label: t.nav.clinicHome, icon: Globe },
    { href: to(href('/privacy')), label: t.legal.privacy, icon: ShieldCheck },
  ];

  const signedIn = !!patient;

  return (
    <>
      <header className={`topnav${scrolled ? ' topnav-scrolled' : ''}${menuOpen ? ' menu-open' : ''}`}>
        <div className="nav-bar glass">
          <a href={scanHome} className="brandmark" aria-label={t.nav.home} onClick={goHome}>
            <span className="brand-lockup" style={{ width: 46, height: 46 }}>
              <Image src="/brand/logo.webp" alt="" width={92} height={92} priority />
            </span>
            <span>
              <b>SKINSCAN</b>
              <small>{tr('BY DR. MAHER MAHMOUD', 'من د. ماهر محمود')}</small>
            </span>
          </a>

          <nav className="nav-links" aria-label={t.nav.navigation}>
            {links.map(({ id, href: url, label, icon: Icon, active, onClick }) => (
              <a
                key={id}
                href={url}
                aria-current={active ? 'page' : undefined}
                className={active ? 'active' : undefined}
                onClick={onClick}
              >
                <Icon size={16} aria-hidden />
                {label}
              </a>
            ))}
          </nav>

          <div className="nav-actions">
            <button
              type="button"
              className="lang-toggle"
              lang={ar ? 'en' : 'ar'}
              onClick={() => (hrefOverride ? (window.location.href = hrefOverride) : switchLanguage(ar ? 'en' : 'ar'))}
              aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              {ar ? 'EN' : 'عربي'}
            </button>

            {hrefOverride ? null : loading ? (
              <span className="acct-skeleton" aria-hidden />
            ) : signedIn ? (
              <AccountMenu
                name={patient.name}
                email={patient.email}
                accountHref={accountHref}
                onSignOut={logout}
                tr={tr}
              />
            ) : (
              <button type="button" className="acct-signin" onClick={() => openSignIn()} aria-haspopup="dialog">
                <LogIn size={16} className="flip-rtl" aria-hidden />
                <span>{t.nav.signIn}</span>
              </button>
            )}

            {!hrefOverride && (
              <button
                type="button"
                className="nav-burger"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="site-menu"
                aria-label={menuOpen ? tr('Close menu', 'إغلاق القائمة') : tr('Menu', 'القائمة')}
              >
                {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
              </button>
            )}
          </div>
        </div>

        {menuOpen && (
          <>
            <button
              type="button"
              className="nav-scrim"
              aria-label={tr('Close menu', 'إغلاق القائمة')}
              tabIndex={-1}
              onClick={closeMenu}
            />
            <nav id="site-menu" className="nav-sheet glass" aria-label={tr('Site menu', 'قائمة الموقع')}>
              <a className="sheet-book" href={scanHome} onClick={goHome}>
                <ScanFace size={18} aria-hidden />
                {t.landing.start}
                <ChevronRight size={18} className="flip-rtl" aria-hidden />
              </a>
              {menu.map(({ href: url, label, icon: Icon }) => (
                <a key={url} href={url} onClick={closeMenu}>
                  <Icon size={18} aria-hidden />
                  {label}
                  <ChevronRight size={18} className="flip-rtl" aria-hidden />
                </a>
              ))}
              <div className="sheet-foot">
                <span className="dim">{tr('Language', 'اللغة')}</span>
                <button
                  type="button"
                  className="sheet-lang"
                  onClick={() => {
                    closeMenu();
                    switchLanguage(ar ? 'en' : 'ar');
                  }}
                >
                  {ar ? 'English' : 'العربية'}
                </button>
              </div>
            </nav>
          </>
        )}
      </header>

      {/* the top bar is fixed: keep the page clear of it */}
      <div className="topnav-space" aria-hidden />

      <nav className="dock glass" aria-label={t.nav.navigation}>
        <a
          href={scanHome}
          className={scanActive ? 'active' : undefined}
          aria-current={scanActive ? 'page' : undefined}
          onClick={goHome}
        >
          <span className="dock-icon">
            <ScanFace aria-hidden />
          </span>
          <span>{t.nav.scan}</span>
        </a>
        <a href={booking}>
          <span className="dock-icon">
            <CalendarDays aria-hidden />
          </span>
          <span>{t.nav.book}</span>
        </a>
        {signedIn || hrefOverride ? (
          <a href={accountHref}>
            <span className="dock-icon">
              <UserRound aria-hidden />
            </span>
            <span>{t.nav.account}</span>
          </a>
        ) : (
          <button type="button" onClick={() => openSignIn()} disabled={loading}>
            <span className="dock-icon">
              <UserRound aria-hidden />
            </span>
            <span>{t.nav.signIn}</span>
          </button>
        )}
        <a href={clinicHome}>
          <span className="dock-icon">
            <Globe aria-hidden />
          </span>
          <span>{t.nav.clinicHome}</span>
        </a>
      </nav>
    </>
  );
}

function AccountMenu({
  name,
  email,
  accountHref,
  onSignOut,
  tr,
}: {
  name: string;
  email: string;
  accountHref: string;
  onSignOut: () => Promise<void>;
  tr: (en: string, ar: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') setOpen(false);
      } else if (box.current && !box.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const first = name.trim().split(/\s+/)[0] || name;

  return (
    <div className="acct" ref={box}>
      <button
        type="button"
        className="acct-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="acct-avatar" aria-hidden>
          {first.charAt(0).toUpperCase()}
        </span>
        <span className="acct-name">{first}</span>
        <ChevronDown size={15} aria-hidden />
      </button>

      {open && (
        <div className="acct-menu glass" role="menu">
          <div className="acct-who">
            <UserRound size={16} aria-hidden />
            <span>
              <b>{name}</b>
              <small dir="ltr">{email}</small>
            </span>
          </div>
          <a role="menuitem" href={accountHref}>
            <CalendarDays size={16} aria-hidden /> {tr('My account & bookings', 'حسابي وحجوزاتي')}
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await onSignOut();
            }}
          >
            <LogOut size={16} className="flip-rtl" aria-hidden /> {tr('Sign out', 'تسجيل الخروج')}
          </button>
        </div>
      )}
    </div>
  );
}
