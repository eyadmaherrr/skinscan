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
