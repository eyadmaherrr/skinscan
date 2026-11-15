'use client';

import Image from 'next/image';
import { ArrowUpRight, CalendarDays, MapPin, MessageCircle, Phone, Video } from 'lucide-react';
import { useI18n } from './LocaleProvider';
import { bookingLink, clinicLink } from '@/lib/client/use-auth';
import { format } from '@/lib/messages';
import { publicConfig } from '@/lib/public-config';
import { SOCIAL_ICON_PATHS, SOCIAL_LINKS } from '@/lib/social';

/**
 * Footer, the same as drmahermahmoud.com's: a dark panel with a "book a
 * visit" call to action, the brand and social accounts, link columns, the
 * three clinics, the clinic network and the legal links. SkinScan's own
 * pages take the place of the clinic site's "Explore" column, and the
 * informational-use note closes it.
 */

const CLINICS = [
  {
    id: 'new-cairo',
    name: { en: 'New Cairo', ar: 'القاهرة الجديدة' },
    place: 'Cairo Medical Center (CMC)',
    days: { en: 'Every day except Friday', ar: 'كل الأيام ما عدا الجمعة' },
    phone: '+201114654440',
  },
  {
    id: 'mohandessin',
    name: { en: 'Mohandessin', ar: 'المهندسين' },
    place: 'Notion Medical Tower',
    days: { en: 'Every Monday', ar: 'كل يوم إثنين' },
    phone: '+201080099422',
  },
  {
    id: 'sheikh-zayed',
    name: { en: 'Sheikh Zayed', ar: 'الشيخ زايد' },
    place: 'SODIC Medical District',
    days: { en: 'Every Wednesday', ar: 'كل يوم أربعاء' },
    phone: '+201080014100',
  },
] as const;

export default function SiteFooter() {
  const { t, locale, href } = useI18n();
  const f = t.footer;
  const clinic = (path: string) => clinicLink(path, locale);
  // These clinic pages have one address for both languages.
  const clinicShared = (path: string) => `${publicConfig.clinicUrl}${path}`;

  const skinscanLinks = [
    { href: href('/'), label: t.nav.scan },
    { href: href('/products'), label: t.nav.products },
    { href: href('/skin-analysis'), label: t.nav.topics },
    { href: href('/about'), label: t.nav.about },
    { href: href('/contact'), label: t.nav.contact },
  ];
  const patientLinks = [
    { href: bookingLink(locale), label: f.book },
    { href: clinic('/online-appointment'), label: f.onlineConsultation },
    { href: clinicShared('/account'), label: f.account },
    { href: clinicShared('/chat'), label: f.chat },
    { href: clinic('/faq'), label: f.faq },
    { href: clinic('/support'), label: f.support },
  ];

  return (
    <footer className="sf container" role="contentinfo">
      <div className="sf-panel">
        <section className="sf-cta" aria-labelledby="sf-cta-title">
          <div>
            <span className="sf-eyebrow">{f.ctaEyebrow}</span>
            <h2 id="sf-cta-title">{f.ctaTitle}</h2>
            <p>{f.ctaText}</p>
          </div>
          <div className="sf-cta-actions">
            <a className="sf-btn sf-btn-primary" href={bookingLink(locale)}>
              <CalendarDays size={17} aria-hidden />
              {f.bookAppointment}
            </a>
            <a className="sf-btn" href={clinic('/online-appointment')}>
              <Video size={17} aria-hidden />
              {f.onlineConsultation}
            </a>
            <a className="sf-btn" href={clinicShared('/chat')}>
              <MessageCircle size={17} aria-hidden />
              {f.chat}
            </a>
          </div>
        </section>

        <div className="sf-grid">
          <div className="sf-brand">
            <a className="sf-logo" href={clinic('/')}>
              <span className="sf-logo-mark">
                <Image src="/brand/logo.webp" alt="" width={88} height={88} />
              </span>
              <b>
                {locale === 'ar' ? (
                  <>
                    د. ماهر <span>محمود</span>
                  </>
                ) : (
                  <>
                    DR. MAHER <span>MAHMOUD</span>
                  </>
                )}
              </b>
            </a>
            <p>{f.specialty}</p>
            <nav aria-label={f.social}>
              <ul className="sf-social">
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
            </nav>
          </div>

          <nav className="sf-col" aria-label={f.skinscan}>
            <h3>{f.skinscan}</h3>
            <ul>
              {skinscanLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="sf-col" aria-label={f.patients}>
            <h3>{f.patients}</h3>
            <ul>
              {patientLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <section className="sf-col sf-clinics" aria-labelledby="sf-clinics-title">
            <h3 id="sf-clinics-title">
              <a href={clinic('/support')}>{f.clinics}</a>
            </h3>
            <ul>
              {CLINICS.map((c) => (
                <li key={c.id}>
                  <b>
                    <MapPin size={14} aria-hidden />
                    {c.name[locale]}
                  </b>
                  <span>{c.place}</span>
                  <span>{c.days[locale]}</span>
                  <a href={`tel:${c.phone}`} dir="ltr">
                    <Phone size={13} aria-hidden />
                    {c.phone}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="sf-network">
          <span>{f.network}</span>
          <a href={clinic('/')}>
            <b>{f.name}</b>
            <small>{f.clinicSite}</small>
            <ArrowUpRight size={14} className="flip-rtl" aria-hidden />
          </a>
          <a href="https://bossmenclinics.com" target="_blank" rel="noopener noreferrer">
            <b>{f.bossmen}</b>
            <small>{f.bossmenNote}</small>
            <ArrowUpRight size={14} className="flip-rtl" aria-hidden />
          </a>
        </div>

        <div className="sf-base">
          {/* Pages are prerendered; the visitor's clock may be in a later year. */}
          <span suppressHydrationWarning>{format(f.copyright, { year: new Date().getFullYear() })}</span>
          <nav aria-label={f.navigation}>
            <a href={href('/privacy')}>{t.legal.privacy}</a>
            <a href={href('/terms')}>{t.legal.terms}</a>
            <a href={clinicShared('/delete-data')}>{f.deleteData}</a>
          </nav>
          <span className="sf-professional">{f.note}</span>
        </div>
      </div>
    </footer>
  );
}
