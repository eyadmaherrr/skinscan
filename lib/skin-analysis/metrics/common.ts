import type { AlignedFace } from '../alignment';
import { maskedGaussianBlur } from '../image/filters';

export { dogNoiseGain } from '../image/filters';
import type { QualityAssessment } from '../quality';
import type { SkinMasks } from '../skin-mask';
import type { MetricKey, RegionKey } from '../types';

export interface MetricContext {
  face: AlignedFace;
  masks: SkinMasks;
  quality: QualityAssessment;
  /** Lazily computed planes shared between metrics. */
  cache: Map<string, Float32Array>;
  /** Spots found by the blemish metric (reused by the acne lesion summary). */
  spots?: import('./blemishes').Spot[];
  /** Language of the sentences in the result (default English). */
  locale?: import('../../i18n').Locale;
}

/**
 * Output of a metric module, before calibration. `raw` is in the metric's
 * documented physical unit (see docs/SCORING.md); null means the metric could
 * not be measured on this photo.
 */
export interface MetricMeasurement {
  key: MetricKey;
  raw: number | null;
  regionRaw: Partial<Record<RegionKey, number>>;
  /** Fraction (0–1) of the skin this metric needs that was usable. */
  coverage: number;
  /** Metric-specific measurement reliability (0–1), combined later with image-quality factors. */
  reliability: number;
  /** Reason shown to the user when the metric cannot be reported. */
  insufficientReason?: string;
  /** Extra details used in explanations and evaluation (never returned by the API). */
  details: Record<string, number>;
  /**
   * Per-pixel value on the aligned crop, in the same unit as `raw` (0 outside
   * the analysed skin), for the heatmap of where the characteristic was seen.
   */
  map?: Float32Array;
}

export function union(masks: Record<RegionKey, Uint8Array>, keys: readonly RegionKey[]): Uint8Array {
  const n = masks[keys[0]].length;
  const out = new Uint8Array(n);
  for (const k of keys) {
    const m = masks[k];
    for (let i = 0; i < n; i++) if (m[i]) out[i] = 1;
  }
  return out;
}

/** Average coverage of the given regions, weighted equally. */
export function regionCoverage(masks: { coverage: Record<RegionKey, number> }, keys: readonly RegionKey[]): number {
  return keys.reduce((s, k) => s + masks.coverage[k], 0) / keys.length;
}

/** Masked Gaussian blur of a plane, cached by name. */
export function cachedBlur(ctx: MetricContext, name: string, src: Float32Array, mask: Uint8Array, sigmaPx: number): Float32Array {
  const key = `${name}@${sigmaPx.toFixed(2)}`;
  let v = ctx.cache.get(key);
  if (!v) {
    v = maskedGaussianBlur(src, mask, ctx.face.width, ctx.face.height, sigmaPx);
    ctx.cache.set(key, v);
  }
  return v;
}

/** Mean of `values` over each region's mask. */
export function perRegionMean(
  values: Float32Array,
  masks: Record<RegionKey, Uint8Array>,
  keys: readonly RegionKey[],
): Partial<Record<RegionKey, number>> {
  const out: Partial<Record<RegionKey, number>> = {};
  for (const k of keys) {
    let s = 0;
    let n = 0;
    const m = masks[k];
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      s += values[i];
      n++;
    }
    if (n > 50) out[k] = s / n;
  }
  return out;
}

/**
 * Mean of the highest `fraction` of values. Used so that a localised
 * characteristic (a red cheek, a few spots) is not diluted by the rest of
 * the face.
 */
export function topFractionMean(values: Float32Array, fraction: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = Float32Array.from(values).sort();
  const start = Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - fraction)));
  let s = 0;
  for (let i = start; i < sorted.length; i++) s += sorted[i];
  return s / (sorted.length - start);
}

export function countPixels(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) n++;
  return n;
}

export function mm2(px: number, pxPerMm: number): number {
  return px / (pxPerMm * pxPerMm);
}
