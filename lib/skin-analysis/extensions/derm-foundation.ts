import sharp from 'sharp';
import type { AlignedFace } from '../alignment';
import { cropAffine, warpRgb } from '../image/warp';
import type { DermFoundationReport } from '../types';

/**
 * Google Derm Foundation adapter (optional, experimental).
 *
 * Derm Foundation (BiT-M ResNet101x3, TensorFlow SavedModel, gated on
 * Hugging Face under the Health AI Developer Foundations terms) turns a
 * 448×448 skin image into a 6144-dimensional embedding; it makes no
 * predictions by itself. It cannot run inside this Node.js server (≈1.5 GB
 * TensorFlow model), so it is served by the self-hosted embedding service in
 * services/derm-foundation and called here over HTTP.
 *
 * Embeddings stay on the server — they are validated and handed to
 * downstream components, never returned to clients. No downstream component
 * is validated yet, so extraction only runs when DERM_FOUNDATION_ENABLED is set
 * (for evaluation) and the result does not change any score.
 */

export const DERM_FOUNDATION_DIM = 6144;
const INPUT = 448;

export interface DermFoundationConfig {
  enabled: boolean;
  url: string;
  token: string;
  timeoutMs: number;
}

export interface DermFoundationResult {
  report: DermFoundationReport;
  /** Only for in-process downstream use; never serialised. */
  embedding: Float32Array | null;
}

/** Validates an embedding returned by the service. Throws on any problem. */
export function validateEmbedding(value: unknown): Float32Array {
  if (!Array.isArray(value) || value.length !== DERM_FOUNDATION_DIM) throw new Error('embedding has the wrong dimension');
  const out = new Float32Array(DERM_FOUNDATION_DIM);
  let norm = 0;
  for (let i = 0; i < value.length; i++) {
    const v = value[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('embedding contains non-finite values');
    out[i] = v;
    norm += v * v;
  }
  if (norm === 0) throw new Error('embedding is all zeros');
  return out;
}

/** Only the operator's own service is allowed: HTTPS, or plain HTTP to a local/internal host. */
export function isAllowedServiceUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return true;
    if (u.protocol !== 'http:') return false;
    return (
      ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) ||
      !u.hostname.includes('.') ||
      u.hostname.endsWith('.internal') ||
      u.hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
}

export async function faceSquarePng(face: AlignedFace): Promise<Buffer> {
  const side = Math.max(face.width, face.height);
  const m = cropAffine(face.width / 2, face.height / 2, side, side, 0, INPUT, INPUT);
  const { rgb } = warpRgb({ data: face.rgb, width: face.width, height: face.height }, INPUT, INPUT, m);
  return sharp(Buffer.from(rgb), { raw: { width: INPUT, height: INPUT, channels: 3 } }).png().toBuffer();
}

export async function extractDermFoundation(face: AlignedFace, cfg: DermFoundationConfig): Promise<DermFoundationResult> {
  if (!cfg.enabled) {
    return { report: { enabled: false, featureExtractionStatus: 'not_run', downstreamTasks: [] }, embedding: null };
  }
  if (!cfg.url || !isAllowedServiceUrl(cfg.url)) {
    return { report: { enabled: true, featureExtractionStatus: 'not_configured', downstreamTasks: [] }, embedding: null };
  }
  try {
    const body = await faceSquarePng(face);
    const baseUrl = cfg.url.endsWith('/') ? cfg.url : `${cfg.url}/`;
    const response = await fetch(new URL('v1/embed', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'image/png', ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}) },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(cfg.timeoutMs),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`service responded ${response.status}`);
    const json = (await response.json()) as { embedding?: unknown };
    const embedding = validateEmbedding(json.embedding);
    return { report: { enabled: true, featureExtractionStatus: 'ok', downstreamTasks: [] }, embedding };
  } catch {
    return { report: { enabled: true, featureExtractionStatus: 'failed', downstreamTasks: [] }, embedding: null };
  }
}
