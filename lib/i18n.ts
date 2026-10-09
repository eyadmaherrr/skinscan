/**
 * Languages. English lives at /path and Arabic at /ar/path, like
 * drmahermahmoud.com. Safe to import from client and server code.
 */

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function localeDir(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** "/terms" + "ar" -> "/ar/terms", "/" + "ar" -> "/ar". */
export function localePath(path: string, locale: Locale): string {
  if (locale === 'en') return path;
  return path === '/' ? '/ar' : `/ar${path}`;
}

/** "/ar/terms" -> "/terms", "/ar" -> "/". */
export function stripLocale(pathname: string): string {
  if (pathname === '/ar') return '/';
  return pathname.startsWith('/ar/') ? pathname.slice(3) : pathname;
}
