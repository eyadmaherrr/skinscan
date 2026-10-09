'use client';

import { ArrowRight, CalendarDays, Home, RefreshCw } from 'lucide-react';
import BrandHeader from './BrandHeader';
import { useI18n } from './LocaleProvider';
import SiteFooter from './SiteFooter';
import { bookingLink, clinicLink } from '@/lib/client/use-auth';

/**
 * 404 and 503 pages, laid out like drmahermahmoud.com's status pages
 * (code, title, explanation, actions, link to the clinic's support page).
 */
export default function StatusPage({ kind }: { kind: 'notFound' | 'unavailable' }) {
  const { t, locale, href } = useI18n();
  const text = kind === 'notFound' ? t.status.notFound : t.status.unavailable;
  const code = kind === 'notFound' ? '404' : '503';
  const statusPath = href('/503');

  return (
    <>
      {/* During maintenance every link leads back here, as on the clinic website. */}
      <BrandHeader scanActive={false} hrefOverride={kind === 'unavailable' ? statusPath : undefined} />
      <main className="statusPage">
        <section className="statusInner" aria-labelledby="status-title">
          <span className="eyebrow" aria-hidden="true">
            {text.eyebrow}
          </span>
          <p className="statusCode" aria-hidden="true">
            {code}
          </p>
          <h1 id="status-title">{text.title}</h1>
          <p className="statusText">{text.description}</p>

          <div className="statusActions">
            {kind === 'notFound' ? (
              <>
                <a className="btn primary" href={href('/')}>
                  <Home size={18} aria-hidden /> {t.status.notFound.home}
                </a>
                <a className="btn secondary" href={bookingLink(locale)} target="_blank" rel="noopener noreferrer">
                  <CalendarDays size={18} aria-hidden /> {t.status.notFound.book}
                </a>
              </>
            ) : (
              // Heads home: if maintenance is over the visitor gets SkinScan,
              // otherwise the proxy sends them straight back here.
              <a className="btn primary" href={href('/')}>
                <RefreshCw size={18} aria-hidden /> {t.status.unavailable.retry}
              </a>
            )}
          </div>

          <p className="statusSupport">
            {t.status.needHelp}{' '}
            <a href={clinicLink('/support', locale)} target="_blank" rel="noopener noreferrer">
              {t.status.support}
              <ArrowRight className="flipRtl" size={14} aria-hidden />
            </a>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
