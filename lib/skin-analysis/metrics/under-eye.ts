import { maskedValues, median, ramp } from '../image/stats';
import type { RegionKey } from '../types';
import { countPixels, type MetricContext, type MetricMeasurement } from './common';

/**
 * Under-eye darkness index.
 *
 * Colorimetric studies of dark circles compare the lightness (L*) of the
 * under-eye skin with nearby cheek skin. The same comparison is made here,
 * separately for each eye: median L* of the upper cheek just below the
 * under-eye band minus median L* of the under-eye band. Using the person's
 * own cheek as the reference keeps the measure independent of skin tone. The
 * colour difference (b*) is kept to describe whether the darkening looks
 * cooler (bluish/purplish) or warmer (brownish).
 *
 * Overhead light casts shadows under the eyes that look the same as darker
 * skin, so confidence is capped at "moderate" and lowered further when
 * the two sides disagree.
 *
 * Unit of `raw`: mean ΔL* (cheek minus under-eye), floored at 0.
 */

function upperBand(mask: Uint8Array, w: number, h: number, fraction: number): Uint8Array {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { top = y; break; }
  for (let y = h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < w; x++) if (mask[y * w + x]) { bottom = y; break; }
  const out = new Uint8Array(mask.length);
  if (top < 0) return out;
  const limit = top + (bottom - top) * fraction;
  for (let y = top; y <= limit; y++) for (let x = 0; x < w; x++) out[y * w + x] = mask[y * w + x];
  return out;
}

export function measureUnderEye(ctx: MetricContext): MetricMeasurement {
  const { face, masks } = ctx;
  const { width: w, height: h } = face;
  const sides: [RegionKey, RegionKey][] = [
    ['underEyeL', 'cheekL'],
    ['underEyeR', 'cheekR'],
  ];
  const deltas: number[] = [];
  const deltaB: number[] = [];
  const regionRaw: Partial<Record<RegionKey, number>> = {};
  for (const [eye, cheek] of sides) {
    const eyeMask = masks.regions[eye];
    const ref = upperBand(masks.regions[cheek], w, h, 0.4);
    if (countPixels(eyeMask) < 150 || countPixels(ref) < 150 || masks.coverage[eye] < 0.35) continue;
    const dL = median(maskedValues(face.lab.L, ref)) - median(maskedValues(face.lab.L, eyeMask));
    const dB = median(maskedValues(face.lab.b, eyeMask)) - median(maskedValues(face.lab.b, ref));
    deltas.push(dL);
    deltaB.push(dB);
    regionRaw[eye] = Math.max(0, dL);
  }
  const coverage = (masks.coverage.underEyeL + masks.coverage.underEyeR) / 2;
  if (deltas.length === 0) {
    return { key: 'underEye', raw: null, regionRaw: {}, coverage, reliability: 0, insufficientReason: 'not_visible', details: {} };
  }
  const raw = deltas.reduce((s, d) => s + Math.max(0, d), 0) / deltas.length;
  const asymmetry = deltas.length === 2 ? Math.abs(deltas[0] - deltas[1]) : 4;
  return {
    key: 'underEye',
    raw,
    regionRaw,
    coverage,
    reliability: 0.66 * (deltas.length === 2 ? 1 : 0.8) * (0.6 + 0.4 * ramp(6, 1.5, asymmetry)),
    details: { asymmetry, deltaB: deltaB.reduce((s, d) => s + d, 0) / deltaB.length },
  };
}
