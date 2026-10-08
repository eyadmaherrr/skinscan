/**
 * Public configuration (safe to expose to the browser). NEXT_PUBLIC_* values
 * are inlined at build time, so changing them requires a rebuild.
 */
import { PRODUCTION_URL } from './brand';

export const publicConfig = {
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === 'production' ? PRODUCTION_URL : 'http://localhost:3000'),
  /** Base URL of the scan API. Empty means "same origin". */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL || 'https://drmahermahmoud.com/book',
  clinicUrl: process.env.NEXT_PUBLIC_CLINIC_URL || 'https://drmahermahmoud.com',
} as const;
