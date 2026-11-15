import { NextResponse } from 'next/server';
import { getPatientSessionToken, verifyPatientSession } from '../auth';
import { serverConfig } from '../config';
import { isLocale, type Locale } from '../i18n';
import { messages } from '../messages';
import { clientKey, rateLimit } from '../rate-limit';
import type { ProductErrorCode, ProductFailure } from './types';

/**
 * What /api/product-lookup and /api/product-search share: the same order as
 * /api/skin-scan (rate limit, then sign-in, then the body), one rate-limit
 * bucket for both, localised errors and no-store responses.
 */

const STATUS: Record<ProductErrorCode, number> = {
  unauthenticated: 401,
  invalid_request: 400,
  invalid_barcode: 400,
  rate_limited: 429,
  unavailable: 503,
};

export const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export function failure(code: ProductErrorCode, locale: Locale, extraHeaders: Record<string, string> = {}) {
  const body: ProductFailure = { success: false, error: { code, message: messages(locale).product.errors[code] } };
  return NextResponse.json(body, { status: STATUS[code], headers: { ...NO_STORE, ...extraHeaders } });
}

/**
 * Operational log line. Contains no barcode or search text (what a patient
 * uses on their skin is personal), no IP address and no personal data.
 */
export function log(event: string, outcome: string, startedAt: number, extra: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ event, outcome, ms: Date.now() - startedAt, ...extra }));
}

/**
 * Rate limit (so floods never reach the clinic's auth API), sign-in, then the
 * small JSON body. Returns the body and locale, or the response to send.
 */
export async function readProductRequest(
  request: Request,
  event: string,
  startedAt: number,
): Promise<{ body: Record<string, unknown>; locale: Locale } | { response: NextResponse }> {
  const queryLocale = new URL(request.url).searchParams.get('locale');
  let locale: Locale = isLocale(queryLocale) ? queryLocale : 'en';

  const limit = rateLimit(`product:${clientKey(request.headers)}`, serverConfig.productRateLimitMax, serverConfig.rateLimitWindowMs);
  if (!limit.allowed) {
    log(event, 'rate_limited', startedAt);
    return { response: failure('rate_limited', locale, { 'Retry-After': String(limit.retryAfterSeconds) }) };
  }

  if (serverConfig.requireAuth) {
    const auth = await verifyPatientSession(getPatientSessionToken(request));
    if (!auth.authenticated) {
      log(event, 'unauthenticated', startedAt);
      return { response: failure('unauthenticated', locale) };
    }
  }

  if (Number(request.headers.get('content-length') ?? 0) > 1024) return { response: failure('invalid_request', locale) };
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: failure('invalid_request', locale) };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { response: failure('invalid_request', locale) };
  const fields = body as Record<string, unknown>;
  if (isLocale(fields.locale)) locale = fields.locale;
  return { body: fields, locale };
}
