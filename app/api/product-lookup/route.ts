import { NextResponse } from 'next/server';
import { serverConfig } from '@/lib/config';
import { getPatientSessionToken, verifyPatientSession } from '@/lib/auth';
import { isLocale, type Locale } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { normalizeBarcode } from '@/lib/products/barcode';
import { lookupProduct, ProductDbUnavailable } from '@/lib/products/open-beauty-facts';
import type { ProductErrorCode, ProductLookupResponse } from '@/lib/products/types';
import { clientKey, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 20;

const STATUS: Record<ProductErrorCode, number> = {
  unauthenticated: 401,
  invalid_request: 400,
  invalid_barcode: 400,
  rate_limited: 429,
  unavailable: 503,
};

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

function failure(code: ProductErrorCode, locale: Locale, extraHeaders: Record<string, string> = {}) {
  const body: ProductLookupResponse = { success: false, error: { code, message: messages(locale).product.errors[code] } };
  return NextResponse.json(body, { status: STATUS[code], headers: { ...NO_STORE, ...extraHeaders } });
}

/**
 * Operational log line. Contains no barcode (what a patient uses on their skin
 * is personal), no IP address and no personal data.
 */
function log(outcome: string, startedAt: number, extra: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ event: 'product_lookup', outcome, ms: Date.now() - startedAt, ...extra }));
}

/**
 * POST { code: "3337875597197", locale?: "ar" } — looks a skincare product up
 * by barcode and describes its well-established ingredients
 * (docs/PRODUCT_SCAN.md). The barcode travels in the body, not the URL, so it
 * stays out of access logs.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();
  const queryLocale = new URL(request.url).searchParams.get('locale');
  let locale: Locale = isLocale(queryLocale) ? queryLocale : 'en';

  // Rate limit first (its own bucket, apart from photo scans), so floods never reach the clinic's auth API.
  const limit = rateLimit(`product:${clientKey(request.headers)}`, serverConfig.productRateLimitMax, serverConfig.rateLimitWindowMs);
  if (!limit.allowed) {
    log('rate_limited', startedAt);
    return failure('rate_limited', locale, { 'Retry-After': String(limit.retryAfterSeconds) });
  }

  if (serverConfig.requireAuth) {
    const auth = await verifyPatientSession(getPatientSessionToken(request));
    if (!auth.authenticated) {
      log('unauthenticated', startedAt);
      return failure('unauthenticated', locale);
    }
  }

  if (Number(request.headers.get('content-length') ?? 0) > 1024) return failure('invalid_request', locale);
  let body: { code?: unknown; locale?: unknown; format?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return failure('invalid_request', locale);
  }
  if (!body || typeof body !== 'object') return failure('invalid_request', locale);
  if (isLocale(body.locale)) locale = body.locale;
  if (typeof body.code !== 'string' || body.code.length > 32) return failure('invalid_request', locale);

  const code = normalizeBarcode(body.code, typeof body.format === 'string' ? body.format : undefined);
  if (!code) {
    log('invalid_barcode', startedAt);
    return failure('invalid_barcode', locale);
  }

  try {
    const result = await lookupProduct(code, locale);
    if (!result) {
      log('not_found', startedAt);
      const notFound: ProductLookupResponse = { success: true, found: false, code };
      return NextResponse.json(notFound, { headers: NO_STORE });
    }
    log('found', startedAt, { ingredients: result.product.ingredientCount > 0, described: result.product.matches.length });
    const found: ProductLookupResponse = { success: true, found: true, ...result };
    return NextResponse.json(found, { headers: NO_STORE });
  } catch (error) {
    log('unavailable', startedAt, { reason: error instanceof ProductDbUnavailable ? error.message : 'error' });
    return failure('unavailable', locale, { 'Retry-After': '30' });
  }
}
