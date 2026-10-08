import path from 'node:path';

/**
 * Server-side configuration. Every value can be overridden with an
 * environment variable so the same build runs locally, on staging and on
 * https://skinscan.drmahermahmoud.com without code changes.
 */

function int(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export const serverConfig = {
  /** Directory that holds the ONNX models and their checksums. */
  modelDir: process.env.SKIN_SCAN_MODEL_DIR || path.join(process.cwd(), 'models'),
  /** Largest upload accepted by the API, in bytes. */
  maxUploadBytes: int('SKIN_SCAN_MAX_UPLOAD_MB', 8, 1, 25) * 1024 * 1024,
  /** Images with more pixels than this are refused before decoding (decompression-bomb guard). */
  maxInputPixels: int('SKIN_SCAN_MAX_INPUT_MEGAPIXELS', 40, 4, 100) * 1_000_000,
  /** Images are downscaled so the longest side is at most this many pixels before analysis. */
  maxAnalysisSide: int('SKIN_SCAN_MAX_ANALYSIS_SIDE', 2560, 1024, 4096),
  /** Hard deadline for a single scan, in milliseconds. */
  timeoutMs: int('SKIN_SCAN_TIMEOUT_MS', 25_000, 5_000, 120_000),
  /** Scans processed at the same time by one server instance; extra requests get a "busy" reply. */
  maxConcurrentScans: int('SKIN_SCAN_MAX_CONCURRENT', 2, 1, 16),
  /** Scans allowed per client IP per rolling window. */
  rateLimitMax: int('SKIN_SCAN_RATE_LIMIT', 8, 1, 1000),
  rateLimitWindowMs: int('SKIN_SCAN_RATE_LIMIT_WINDOW_SECONDS', 600, 10, 86_400) * 1000,
  /** Threads ONNX Runtime may use per inference. */
  onnxThreads: int('SKIN_SCAN_ONNX_THREADS', 2, 1, 16),
} as const;

function flag(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

/**
 * Extension components (acne, pores, Derm Foundation). Read on every call so
 * tests and long-running servers pick up environment changes.
 */
export function extensionConfig() {
  const acneModel = process.env.SKINSCAN_ACNE_SEVERITY_MODEL?.trim() || '';
  return {
    acneLesions: flag('SKINSCAN_ACNE_LESIONS', true),
    pores: flag('SKINSCAN_PORES', true),
    /**
     * Optional acne-severity ONNX model (see
     * scripts/convert/convert_acne_classifier.py), given as a file name inside
     * models/optional/. Empty = disabled. Its checksum is read from the .json
     * file written next to it.
     */
    acneSeverityModel: acneModel ? path.join(process.cwd(), 'models', 'optional', path.basename(acneModel)) : '',
    /** Optional Derm Foundation embedding service (services/derm-foundation). */
    dermFoundationEnabled: flag('DERM_FOUNDATION_ENABLED', false),
    dermFoundationUrl: process.env.DERM_FOUNDATION_URL?.trim() || '',
    dermFoundationToken: process.env.DERM_FOUNDATION_TOKEN?.trim() || '',
    dermFoundationTimeoutMs: int('DERM_FOUNDATION_TIMEOUT_MS', 8000, 1000, 60_000),
  };
}
