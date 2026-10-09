import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import AssistantWidget from './AssistantWidget';
import AuthModal from './AuthModal';
import CookieBanner from './CookieBanner';
import { LocaleProvider } from './LocaleProvider';
import { AuthProvider } from '@/lib/client/use-auth';
import { localeDir, type Locale } from '@/lib/i18n';
import '@/app/globals.css';

// Self-hosted at build time by next/font: no request to Google from the visitor's browser.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

/** The <html> document of both root layouts: English at /, Arabic (right-to-left) at /ar. */
export default function RootDocument({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={locale} dir={localeDir(locale)} className={inter.variable}>
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
