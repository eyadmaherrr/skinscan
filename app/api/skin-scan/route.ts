import { NextResponse } from 'next/server';
import { tryAcquire } from '@/lib/concurrency';
import { serverConfig } from '@/lib/config';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { analyzeImage } from '@/lib/skin-analysis';
import { ERROR_MESSAGES, ScanError } from '@/lib/skin-analysis/errors';
import { SUPPORTED_MIME_TYPES } from '@/lib/skin-analysis/image/decode';
import type { ScanErrorCode, ScanFailure } from '@/lib/skin-analysis/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const STATUS: Record<ScanErrorCode, number> = {
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

function failure(error: ScanError, extraHeaders: Record<string, string> = {}): NextResponse<ScanFailure> {
  const body: ScanFailure = {
    success: false,
    error: { code: error.code, message: ERROR_MESSAGES[error.code] },
  };
  if (error.code === 'image_quality') {
    body.imageQuality = { acceptable: false, issues: error.issues };
    if (error.issues[0]) body.error.message = error.issues[0].message;
  }
  return NextResponse.json(body, { status: STATUS[error.code], headers: { ...NO_STORE, ...extraHeaders } });
}

/** Operational log line. Contains no image data, no IP address and no personal data. */
function log(outcome: string, startedAt: number, extra: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ event: 'skin_scan', outcome, ms: Date.now() - startedAt, ...extra }));
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  const limit = rateLimit(clientKey(request.headers), serverConfig.rateLimitMax, serverConfig.rateLimitWindowMs);
  if (!limit.allowed) {
    log('rate_limited', startedAt);
    return failure(new ScanError('rate_limited'), { 'Retry-After': String(limit.retryAfterSeconds) });
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > serverConfig.maxUploadBytes + 64 * 1024) {
    log('file_too_large', startedAt);
    return failure(new ScanError('file_too_large'));
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) {
    return failure(new ScanError('invalid_request'));
  }

  let file: File;
  try {
    const form = await request.formData();
    const value = form.get('image');
    if (!(value instanceof File) || value.size === 0) return failure(new ScanError('invalid_request'));
    file = value;
  } catch {
    return failure(new ScanError('invalid_request'));
  }
  if (file.size > serverConfig.maxUploadBytes) return failure(new ScanError('file_too_large'));
  if (file.type && !SUPPORTED_MIME_TYPES[file.type.toLowerCase()]) return failure(new ScanError('unsupported_type'));

  const release = tryAcquire(serverConfig.maxConcurrentScans);
  if (!release) {
    log('busy', startedAt);
    return failure(new ScanError('busy'), { 'Retry-After': '5' });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = analyzeImage(buffer, {
      maxInputPixels: serverConfig.maxInputPixels,
      maxSide: serverConfig.maxAnalysisSide,
      deadline: startedAt + serverConfig.timeoutMs,
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
      return failure(error);
    }
    console.error(JSON.stringify({ event: 'skin_scan', outcome: 'error', message: error instanceof Error ? error.message : 'unknown' }));
    return failure(new ScanError('analysis_failed'));
  } finally {
    if (timer) clearTimeout(timer);
  }
}
