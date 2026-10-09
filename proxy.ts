import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { serverConfig } from '@/lib/config';
import { createSiteLockCache, fetchClinicSiteLock } from '@/lib/site-lock';

/**
 * Maintenance mode. SkinScan follows the clinic website's switch (the admin
 * panel's site lock, see lib/site-lock.ts): while it is on, every page
 * redirects to /503 (/ar/503 for Arabic pages), like drmahermahmoud.com.
 * The 503 pages themselves and the API are never redirected.
 */

const siteLock = createSiteLockCache({
  ttlMs: 10_000,
  maxStaleMs: 30_000,
  fetchLocked: () => fetchClinicSiteLock(serverConfig.clinicUrl),
});

const STATUS_PAGES = new Set(['/503', '/ar/503']);

/** <Link> prefetches and browser speculative loads. */
function isPrefetch(request: NextRequest): boolean {
  return (
    request.headers.has('next-router-prefetch') ||
    request.headers.get('purpose') === 'prefetch' ||
    (request.headers.get('sec-purpose') ?? '').includes('prefetch')
  );
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  if (STATUS_PAGES.has(pathname)) return NextResponse.next();

  const locked = await siteLock.isLocked({
    prefetch: isPrefetch(request),
    waitUntil: (promise) => event.waitUntil(promise),
  });
  if (!locked) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = pathname === '/ar' || pathname.startsWith('/ar/') ? '/ar/503' : '/503';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Pages only: not Next.js internals, the API or static files.
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
