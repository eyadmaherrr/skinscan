/**
 * Public configuration (safe to expose to the browser and server). NEXT_PUBLIC_* values
 * are inlined at build time, so changing them requires a rebuild.
 */
import { PRODUCTION_URL } from './brand';
import { localePath, type Locale } from './i18n';

export const publicConfig = {
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === 'production' ? PRODUCTION_URL : 'http://localhost:3000'),
  /** Base URL of the scan API. Empty means "same origin". */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL || 'https://www.drmahermahmoud.com/book',
  /** The clinic website (sign-in, account, booking). */
  clinicUrl: (process.env.NEXT_PUBLIC_CLINIC_URL || 'https://www.drmahermahmoud.com').replace(/\/+$/, ''),
} as const;

export function clinicLink(path: string, locale: Locale): string {
  return `${publicConfig.clinicUrl}${localePath(path, locale)}`;
}

export function bookingLink(locale: Locale): string {
  const url = publicConfig.bookingUrl;
  const base = publicConfig.clinicUrl;
  return locale === 'ar' && url.startsWith(`${base}/`) ? `${base}/ar${url.slice(base.length)}` : url;
}
