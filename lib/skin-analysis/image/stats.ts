/**
 * Robust statistics over masked pixels. Large masks are sub-sampled on a
 * fixed grid (never randomly), so the same image always gives the same result.
 */

const MAX_SAMPLES = 250_000;

/** Values of `src` where `mask` is set (deterministically sub-sampled when very large). */
export function maskedValues(src: Float32Array, mask: Uint8Array): Float32Array {
  let count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) count++;
  const stride = Math.max(1, Math.ceil(count / MAX_SAMPLES));
  const out = new Float32Array(Math.ceil(count / stride));
  let seen = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    if (seen % stride === 0) out[n++] = src[i];
    seen++;
  }
  return out.subarray(0, n);
}

export function countMask(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) n++;
  return n;
}

/** Quantiles (0–1) of a sample, by sorting a copy. Returns NaN for empty input. */
export function quantiles(values: Float32Array, qs: number[]): number[] {
  if (values.length === 0) return qs.map(() => Number.NaN);
  const sorted = Float32Array.from(values).sort();
  return qs.map((q) => {
    const pos = Math.min(1, Math.max(0, q)) * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(sorted.length - 1, lo + 1);
    const t = pos - lo;
    return sorted[lo] * (1 - t) + sorted[hi] * t;
  });
}

export function median(values: Float32Array): number {
  return quantiles(values, [0.5])[0];
}

/** Median and scaled median absolute deviation (a robust standard deviation). */
export function robustSpread(values: Float32Array): { median: number; sigma: number } {
  if (values.length === 0) return { median: Number.NaN, sigma: Number.NaN };
  const m = median(values);
  const dev = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) dev[i] = Math.abs(values[i] - m);
  return { median: m, sigma: 1.4826 * median(dev) };
}

export function mean(values: Float32Array): number {
  if (values.length === 0) return Number.NaN;
  let s = 0;
  for (let i = 0; i < values.length; i++) s += values[i];
  return s / values.length;
}

/** Mean of f(value) over masked pixels (no sub-sampling). */
export function maskedMeanOf(src: Float32Array, mask: Uint8Array, f: (v: number) => number): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    s += f(src[i]);
    n++;
  }
  return n ? s / n : Number.NaN;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Smooth 0→1 ramp between edge0 and edge1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Linear 0→1 ramp between edge0 and edge1 (works for decreasing ramps when edge0 > edge1). */
export function ramp(edge0: number, edge1: number, x: number): number {
  return clamp((x - edge0) / (edge1 - edge0), 0, 1);
}
