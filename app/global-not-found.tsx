import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { messages } from '@/lib/messages';
import './globals.css';

// The site has two root layouts (English and Arabic), so unknown URLs get this standalone page.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: `${messages('en').notFound.title} | ${messages('en').siteName}`,
  robots: { index: false },
};

export default function GlobalNotFound() {
  const en = messages('en').notFound;
  const ar = messages('ar').notFound;
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <main className="page notFound">
          <section className="stepCard glass">
            <h1>404</h1>
            <h2>{en.title}</h2>
            <p className="muted">{en.text}</p>
            <h2 lang="ar" dir="rtl">
              {ar.title}
            </h2>
            <div className="actions center">
              <Link className="btn primary" href="/">
                {en.home}
              </Link>
              <a className="btn secondary" href="/ar" lang="ar" dir="rtl">
                {ar.home}
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
