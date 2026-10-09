import type { Metadata, Viewport } from 'next';
import { localePath, type Locale } from './i18n';
import { messages } from './messages';
import { publicConfig } from './public-config';

/** Metadata shared by both languages' root layouts and pages. */

const DESCRIPTION: Record<Locale, string> = {
  en: 'Analyze visible skin characteristics from a facial photo using AI-powered computer vision. Informational only — not a medical diagnosis.',
  ar: 'حلّل الخصائص الظاهرة لبشرتك من صورة للوجه باستخدام الرؤية الحاسوبية المدعومة بالذكاء الاصطناعي. لأغراض المعلومات فقط، وليس تشخيصًا طبيًا.',
};

/** canonical + hreflang links for a page that exists in both languages. */
export function alternates(path: string, locale: Locale): Metadata['alternates'] {
  return {
    canonical: localePath(path, locale),
    languages: { en: path, ar: localePath(path, 'ar'), 'x-default': path },
  };
}

export function rootMetadata(locale: Locale): Metadata {
  const t = messages(locale);
  const title = `${t.siteName} | ${t.clinicName}`;
  return {
    metadataBase: new URL(publicConfig.appUrl),
    title,
    description: DESCRIPTION[locale],
    applicationName: t.siteName,
    alternates: alternates('/', locale),
    openGraph: {
      title,
      description: DESCRIPTION[locale],
      url: localePath('/', locale),
      siteName: t.siteName,
      locale: locale === 'ar' ? 'ar_EG' : 'en_US',
      type: 'website',
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b2d4d',
};
