import type { ReactNode } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, HelpCircle, Info, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react';
import BrandHeader from '../BrandHeader';
import SiteFooter from '../SiteFooter';
import type { EducationalPageData } from '@/lib/content/pages-content';
import { bookingLink, clinicLink } from '@/lib/public-config';
import { localePath, type Locale } from '@/lib/i18n';
import { buildBreadcrumbSchema, buildMedicalOrganizationSchema, buildMedicalWebPageSchema } from '@/lib/site-metadata';

interface ContentLayoutProps {
  locale: Locale;
  data: EducationalPageData;
  children?: ReactNode;
}

export default function ContentLayout({ locale, data, children }: ContentLayoutProps) {
  const isAr = locale === 'ar';
  const startScanLabel = isAr ? 'ابدأ فحص البشرة الآن' : 'Start Your Free Skin Scan';
  const bookLabel = isAr ? 'حجز كشف في العيادة' : 'Book Clinic Appointment';
  const relatedLabel = isAr ? 'موضوعات ذات صلة' : 'Related Skin Topics';
  const faqsLabel = isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions';
  const updatedPrefix = isAr ? 'آخر تحديث ومراجعة:' : 'Reviewed & Updated:';
  const homeLabel = isAr ? 'الرئيسية' : 'Home';

  const orgSchema = buildMedicalOrganizationSchema(locale);
  const breadcrumbSchema = buildBreadcrumbSchema(data.breadcrumbs, locale);
  const webPageSchema = buildMedicalWebPageSchema(data.title, data.subtitle, data.slug, locale);

  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />

      <BrandHeader scanActive={false} />

      <main className="privacy-page contentPage" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="privacy-container contentContainer">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="contentBreadcrumbs">
            <ol>
              {data.breadcrumbs.map((crumb, idx) => {
                const isLast = idx === data.breadcrumbs.length - 1;
                return (
                  <li key={crumb.path}>
                    {isLast ? (
                      <span aria-current="page">{crumb.name}</span>
                    ) : (
                      <>
                        <a href={localePath(crumb.path, locale)}>{crumb.name}</a>
                        <ChevronRight size={14} className="crumbSeparator flipRtl" aria-hidden />
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Header */}
          <header className="privacy-header contentHeader">
            <span className="privacy-badge">{data.badge}</span>
            <h1>{data.title}</h1>
            <p className="privacy-subtitle">{data.subtitle}</p>

            <div className="contentMetaBar">
              <span className="reviewerBadge">
                <Stethoscope size={14} aria-hidden />
                <span>{data.reviewer}</span>
              </span>
              <span className="updated">
                {updatedPrefix} {data.lastUpdated}
              </span>
            </div>
          </header>

          {/* Main Body Sections */}
          <article className="contentBody">
            {data.sections.map((section) => (
              <section key={section.title} className="privacy-section contentSection">
                <h2>{section.title}</h2>
                {section.lead ? <p className="sectionLead">{section.lead}</p> : null}
                {section.paragraphs.map((p, pIdx) => (
                  <p key={pIdx}>{p}</p>
                ))}

                {section.bulletPoints && section.bulletPoints.length > 0 ? (
                  <ul className="contentBulletList">
                    {section.bulletPoints.map((bullet, bIdx) => (
                      <li key={bIdx}>
                        <CheckCircle2 size={16} className="bulletIcon" aria-hidden />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {section.callout ? (
                  <aside className={`contentCallout callout-${section.callout.type}`}>
                    <div className="calloutHeader">
                      {section.callout.type === 'privacy' && <ShieldCheck size={18} aria-hidden />}
                      {section.callout.type === 'clinical' && <Stethoscope size={18} aria-hidden />}
                      {section.callout.type === 'info' && <Info size={18} aria-hidden />}
                      {section.callout.type === 'tip' && <Sparkles size={18} aria-hidden />}
                      <strong>{section.callout.title}</strong>
                    </div>
                    <p>{section.callout.text}</p>
                  </aside>
                ) : null}
              </section>
            ))}

            {children}

            {/* FAQs */}
            {data.faqs && data.faqs.length > 0 ? (
              <section className="privacy-section contentFaqs">
                <h2>{faqsLabel}</h2>
                <div className="faqGrid">
                  {data.faqs.map((faq, fIdx) => (
                    <details key={fIdx} className="faqItem" open={fIdx === 0}>
                      <summary className="faqQuestion">
                        <HelpCircle size={17} className="faqIcon" aria-hidden />
                        <span>{faq.question}</span>
                      </summary>
                      <p className="faqAnswer">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Related Topics */}
            {data.relatedTopics && data.relatedTopics.length > 0 ? (
              <section className="privacy-section contentRelated">
                <h2>{relatedLabel}</h2>
                <div className="relatedGrid">
                  {data.relatedTopics.map((item) => (
                    <a
                      key={item.path}
                      href={localePath(item.path, locale)}
                      className="relatedCard"
                    >
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <span className="relatedLink">
                        {isAr ? 'قراءة الدليل' : 'Read Guide'}
                        <ArrowRight size={14} className="flipRtl" aria-hidden />
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}
          </article>

          {/* Bottom Conversion Actions */}
          <div className="contentCtaBox">
            <div className="ctaContent">
              <h3>{isAr ? 'جرّب فحص البشرة الآن مجانًا' : 'Ready to Analyze Your Skin?'}</h3>
              <p>
                {isAr
                  ? 'التقط صورة واضحة لوجهك واحصل على تقرير تشريحي فوري بالذكاء الاصطناعي خلال ثوانٍ معدودة دون حفظ صورتك.'
                  : 'Take a clear facial photo and receive instant regional AI insights across 24 anatomical facial zones with zero photo storage.'}
              </p>
            </div>
            <div className="ctaButtons">
              <a href={localePath('/scan', locale)} className="btn primary lg ctaBtn">
                {startScanLabel} <ArrowRight className="flipRtl" size={18} aria-hidden />
              </a>
              <a
                href={bookingLink(locale)}
                className="btn secondary lg ctaBtn"
                target="_blank"
                rel="noopener noreferrer"
              >
                <CalendarDays size={18} aria-hidden />
                {bookLabel}
              </a>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
