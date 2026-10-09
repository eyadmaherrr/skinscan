import type { ReactNode } from 'react';
import BrandHeader from '../BrandHeader';
import { messages } from '@/lib/messages';
import { localePath, type Locale } from '@/lib/i18n';
import { publicConfig } from '@/lib/public-config';

export interface LegalSection {
  title: string;
  intro?: ReactNode;
  items?: ReactNode[];
  outro?: ReactNode;
}

export interface LegalContent {
  badge: string;
  title: string;
  subtitle: string;
  updated: string;
  sections: LegalSection[];
}

/** Layout of the Terms and Privacy pages (same look as drmahermahmoud.com's legal pages). */
export default function LegalPage({ locale, content, other }: { locale: Locale; content: LegalContent; other: 'terms' | 'privacy' }) {
  const t = messages(locale);
  const back = locale === 'ar' ? 'العودة إلى SkinScan' : 'Return to SkinScan';
  const visit = locale === 'ar' ? 'زيارة موقع العيادة' : 'Visit the clinic website';
  return (
    <>
      <BrandHeader scanActive={false} />
      <main className="privacy-page">
        <div className="privacy-container">
          <div className="privacy-header">
            <span className="privacy-badge">{content.badge}</span>
            <h1>{content.title}</h1>
            <p className="privacy-subtitle">{content.subtitle}</p>
            <span className="updated">{content.updated}</span>
          </div>

          {content.sections.map((section) => (
            <section key={section.title} className="privacy-section">
              <h2>{section.title}</h2>
              {section.intro ? <p>{section.intro}</p> : null}
              {section.items ? (
                <ul>
                  {section.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.outro ? <p>{section.outro}</p> : null}
            </section>
          ))}

          <div className="privacy-actions">
            <a href={localePath('/', locale)} className="privacy-action">
              {back}
            </a>
            <a href={localePath(`/${other}`, locale)} className="privacy-action">
              {other === 'terms' ? t.legal.terms : t.legal.privacy}
            </a>
            <a href={`${publicConfig.clinicUrl}${localePath('/', locale)}`} className="privacy-action" target="_blank" rel="noopener noreferrer">
              {visit}
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
