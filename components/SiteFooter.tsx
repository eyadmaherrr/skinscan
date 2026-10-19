'use client';

import Image from 'next/image';
import { useI18n } from './LocaleProvider';
import { clinicLink } from '@/lib/client/use-auth';
import { format } from '@/lib/messages';
import { SOCIAL_ICON_PATHS, SOCIAL_LINKS } from '@/lib/social';

/**
 * Footer, laid out like drmahermahmoud.com's: the brand, the clinic and its
 * social accounts, SkinScan's and the clinic's pages (in the visitor's
 * language), and the informational-use note.
 */
export default function SiteFooter() {
  const { t, locale, href } = useI18n();
  const f = t.footer;
  const isAr = locale === 'ar';
  const clinic = (path: string) => clinicLink(path, locale);

  return (
    <footer className="site-foot container" role="contentinfo">
      <div className="footer-main">
        <a href={href('/')} className="footer-brand">
          <span className="brand-lockup" style={{ width: 44, height: 44 }}>
            <Image src="/brand/logo.webp" alt="" width={88} height={88} />
          </span>
          <b>
            SKIN<span>SCAN</span>
          </b>
        </a>
        <p>
          {f.name} · {f.specialty}
        </p>
        <ul className="social footer-social" aria-label={f.social}>
          {SOCIAL_LINKS.map((social) => (
            <li key={social.id}>
              <a
                href={social.url}
                target="_blank"
                rel="noopener noreferrer me"
                aria-label={social.label}
                title={social.label}
              >
                <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
                  <path d={SOCIAL_ICON_PATHS[social.id]} />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <nav className="footer-links" aria-label={f.navigation}>
        <a href={href('/')}>{f.skinscan}</a>
        <a href={href('/how-it-works')}>{t.nav.howItWorks}</a>
        <a href={href('/features')}>{t.nav.features}</a>
        <a href={href('/skin-analysis')}>{isAr ? 'تحليل البشرة' : 'Skin Analysis'}</a>
        <a href={href('/about')}>{isAr ? 'عن العيادة' : 'About'}</a>
        <a href={href('/contact')}>{t.nav.contact}</a>
        <a href={clinic('/')}>{t.nav.clinicHome}</a>
        <a href={clinic('/doctor')}>{f.doctor}</a>
        <a href={clinic('/book')}>{f.book}</a>
        <a href={href('/terms')}>{t.legal.terms}</a>
        <a href={href('/privacy')}>{t.legal.privacy}</a>
      </nav>

      <div className="footer-base">
        {/* Pages are prerendered; the visitor's clock may be in a later year. */}
        <span suppressHydrationWarning>{format(f.copyright, { year: new Date().getFullYear() })}</span>
        <span>{f.note}</span>
      </div>
    </footer>
  );
}
