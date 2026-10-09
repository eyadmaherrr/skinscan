'use client';

import { useI18n } from './LocaleProvider';
import { clinicLink } from '@/lib/client/use-auth';
import { format } from '@/lib/messages';
import { SOCIAL_ICON_PATHS, SOCIAL_LINKS } from '@/lib/social';

/**
 * Footer, the same as drmahermahmoud.com's: the clinic, its social
 * accounts and its pages (in the visitor's language), plus SkinScan's own
 * Terms and Privacy Policy and its informational-use note.
 */
export default function SiteFooter() {
  const { t, locale, href } = useI18n();
  const f = t.footer;
  const clinic = (path: string) => clinicLink(path, locale);
  const clinicHome = clinic('/');

  return (
    <footer className="siteFooter" role="contentinfo">
      <div className="siteFooterTop">
        <div>
          <h3>{f.name}</h3>
          <p>{f.specialty}</p>
          <nav className="socialLinks" aria-label={f.social}>
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.id}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer me"
                aria-label={social.label}
                title={social.label}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d={SOCIAL_ICON_PATHS[social.id]} />
                </svg>
              </a>
            ))}
          </nav>
        </div>

        <nav className="siteFooterLinks" aria-label={f.navigation}>
          <a href={href('/')}>{f.skinscan}</a>
          <a href={clinicHome}>{f.home}</a>
          <a href={clinic('/doctor')}>{f.doctor}</a>
          <a href={clinic('/support')}>{f.support}</a>
          <a href={clinic('/book')}>{f.book}</a>
          <a href={`${clinicHome}#services`}>{f.services}</a>
          <a href={`${clinicHome}#branches`}>{f.clinics}</a>
          <a href={clinic('/faq')}>{f.faq}</a>
          <a href={href('/terms')}>{t.legal.terms}</a>
          <a href={href('/privacy')}>{t.legal.privacy}</a>
        </nav>
      </div>

      <div className="siteFooterBottom">
        {/* Pages are prerendered; the visitor's clock may be in a later year. */}
        <span suppressHydrationWarning>{format(f.copyright, { year: new Date().getFullYear() })}</span>
        <span>{f.note}</span>
      </div>
    </footer>
  );
}
