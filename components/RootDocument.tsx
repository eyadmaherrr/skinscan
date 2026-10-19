import type { ReactNode } from 'react';
import { Cairo, Inter, Montserrat } from 'next/font/google';
import AssistantWidget from './AssistantWidget';
import AuthModal from './AuthModal';
import CookieBanner from './CookieBanner';
import { LocaleProvider } from './LocaleProvider';
import { AuthProvider } from '@/lib/client/use-auth';
import { localeDir, type Locale } from '@/lib/i18n';
import '@/app/globals.css';
import '@/app/theme.css';

// Self-hosted at build time by next/font: no request to Google from the visitor's browser.
// The same faces as drmahermahmoud.com: Inter for text, Montserrat for
// headings, Cairo for Arabic.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-montserrat',
});
const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-cairo',
});

/** The <html> document of both root layouts: English at /, Arabic (right-to-left) at /ar. */
export default function RootDocument({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html
      lang={locale}
      dir={localeDir(locale)}
      className={`${inter.variable} ${montserrat.variable} ${cairo.variable}`}
    >
      <body>
        <LocaleProvider locale={locale}>
          <AuthProvider>
            {children}
            <AssistantWidget />
            <AuthModal />
            <CookieBanner />
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
