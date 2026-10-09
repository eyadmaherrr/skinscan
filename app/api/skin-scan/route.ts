import { NextResponse } from 'next/server';
import { tryAcquire } from '@/lib/concurrency';
import { serverConfig } from '@/lib/config';
import { getPatientSessionToken, verifyPatientSession } from '@/lib/auth';
import { isLocale, type Locale } from '@/lib/i18n';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { analyzeImage } from '@/lib/skin-analysis';
import { errorMessage, qualityIssue, ScanError } from '@/lib/skin-analysis/errors';
import { SUPPORTED_MIME_TYPES } from '@/lib/skin-analysis/image/decode';
import type { ScanErrorCode, ScanFailure } from '@/lib/skin-analysis/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const STATUS: Record<ScanErrorCode, number> = {
  unauthenticated: 401,
  invalid_request: 400,
  unsupported_type: 415,
  file_too_large: 413,
  image_unreadable: 422,
  // The analysis ran and concluded the photo needs a retake: a normal outcome, not a failed request.
  image_quality: 200,
  rate_limited: 429,
  busy: 503,
  timeout: 504,
  analysis_failed: 500,
};

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

function failure(error: ScanError, locale: Locale, extraHeaders: Record<string, string> = {}): NextResponse<ScanFailure> {
  const body: ScanFailure = {
    success: false,
    error: { code: error.code, message: errorMessage(error.code, locale) },
  };
  if (error.code === 'image_quality') {
    body.imageQuality = { acceptable: false, issues: error.issues.map((i) => qualityIssue(i.code, locale)) };
    if (body.imageQuality.issues[0]) body.error.message = body.imageQuality.issues[0].message;
  }
  return NextResponse.json(body, { status: STATUS[error.code], headers: { ...NO_STORE, ...extraHeaders } });
}

/** Operational log line. Contains no image data, no IP address and no personal data. */
function log(outcome: string, startedAt: number, extra: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ event: 'skin_scan', outcome, ms: Date.now() - startedAt, ...extra }));
}

/** Optional ?locale=ar (or a "locale" form field): language of messages and explanations. */
function requestLocale(request: Request): Locale {
  const value = new URL(request.url).searchParams.get('locale');
  return isLocale(value) ? value : 'en';
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let locale = requestLocale(request);

  // Rate limit first, so unauthenticated floods never reach the clinic's auth API.
  const limit = rateLimit(clientKey(request.headers), serverConfig.rateLimitMax, serverConfig.rateLimitWindowMs);
  if (!limit.allowed) {
    log('rate_limited', startedAt);
    return failure(new ScanError('rate_limited'), locale, { 'Retry-After': String(limit.retryAfterSeconds) });
  }

  if (serverConfig.requireAuth) {
    const auth = await verifyPatientSession(getPatientSessionToken(request));
    if (!auth.authenticated) {
      log('unauthenticated', startedAt);
      return failure(new ScanError('unauthenticated'), locale);
    }
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > serverConfig.maxUploadBytes + 64 * 1024) {
    log('file_too_large', startedAt);
    return failure(new ScanError('file_too_large'), locale);
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) {
    return failure(new ScanError('invalid_request'), locale);
  }

  let file: File;
  try {
    const form = await request.formData();
    const formLocale = form.get('locale');
    if (isLocale(formLocale)) locale = formLocale;
    const value = form.get('image');
    if (!(value instanceof File) || value.size === 0) return failure(new ScanError('invalid_request'), locale);
    file = value;
  } catch {
    return failure(new ScanError('invalid_request'), locale);
  }
  if (file.size > serverConfig.maxUploadBytes) return failure(new ScanError('file_too_large'), locale);
  if (file.type && !SUPPORTED_MIME_TYPES[file.type.toLowerCase()]) return failure(new ScanError('unsupported_type'), locale);

  const release = tryAcquire(serverConfig.maxConcurrentScans);
  if (!release) {
    log('busy', startedAt);
    return failure(new ScanError('busy'), locale, { 'Retry-After': '5' });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = analyzeImage(buffer, {
      maxInputPixels: serverConfig.maxInputPixels,
      maxSide: serverConfig.maxAnalysisSide,
      deadline: startedAt + serverConfig.timeoutMs,
      locale,
    });
    // The slot is released only when the work has really stopped.
    analysis.then(release, release);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ScanError('timeout')), serverConfig.timeoutMs + 1000);
    });
    const result = await Promise.race([analysis, timeout]);
    log('ok', startedAt, { overallConfidence: result.overallConfidence });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ScanError) {
      log(error.code, startedAt, error.issues.length ? { issues: error.issues.map((i) => i.code) } : {});
      return failure(error, locale);
    }
    console.error(JSON.stringify({ event: 'skin_scan', outcome: 'error', message: error instanceof Error ? error.message : 'unknown' }));
    return failure(new ScanError('analysis_failed'), locale);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
