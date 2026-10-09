import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { CLINIC_NAME, SITE_NAME } from '@/lib/brand';
import { publicConfig } from '@/lib/public-config';
import { AuthProvider } from '@/lib/client/use-auth';
import CookieBanner from '@/components/CookieBanner';
import './globals.css';

// Self-hosted at build time by next/font: no request to Google from the visitor's browser.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL(publicConfig.appUrl),
  title: `${SITE_NAME} | ${CLINIC_NAME}`,
  description:
    'Analyze visible skin characteristics from a facial photo using AI-powered computer vision. Informational only — not a medical diagnosis.',
  applicationName: SITE_NAME,
  openGraph: {
    title: `${SITE_NAME} | ${CLINIC_NAME}`,
    description: 'Analyze visible skin characteristics from a facial photo using AI-powered computer vision.',
    url: '/',
    siteName: SITE_NAME,
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b2d4d',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          {children}
          <CookieBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
