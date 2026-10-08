import { createHash } from 'node:crypto';

/**
 * In-memory sliding-window rate limiter, keyed by a hash of the client IP
 * (raw IPs are never stored). This protects a single server instance; when
 * running several instances (e.g. serverless), replace `store` with a shared
 * store such as Redis/Upstash behind the same interface.
 */

interface Bucket {
  hits: number[];
}

const globalStore = globalThis as unknown as { __skinScanRate?: Map<string, Bucket> };
const store = (globalStore.__skinScanRate ??= new Map<string, Bucket>());
let lastSweep = 0;

export function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
  if (now - lastSweep > windowMs) {
    for (const [k, b] of store) if (!b.hits.length || now - b.hits[b.hits.length - 1] > windowMs) store.delete(k);
    lastSweep = now;
  }
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= max) {
    store.set(key, bucket);
    return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - bucket.hits[0])) / 1000) };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test helper. */
export function resetRateLimits(): void {
  store.clear();
}
