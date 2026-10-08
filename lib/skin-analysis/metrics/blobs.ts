import { gaussianBlur } from '../image/filters';

export interface Blob {
  x: number;
  y: number;
  /** Scale (px) at which the blob responded most strongly. */
  sigma: number;
  /** Detection strength relative to the threshold (≥ 1). */
  strength: number;
}

/**
 * Multi-scale blob detector. `responses(sigma)` must return a map that is
 * positive where a blob of that scale is present (e.g. a difference of
 * Gaussians). Pixels are kept when they are a 3x3 local maximum of the
 * across-scale maximum response, exceed `threshold`, lie in `mask`, and their
 * neighbourhood (2σ) is mostly inside the mask (so region borders and shadows
 * at edges are not counted). Detections closer than 1.5σ are merged.
 */
export function detectBlobs(
  responses: (sigma: number) => Float32Array,
  sigmas: number[],
  threshold: (sigma: number) => number,
  mask: Uint8Array,
  w: number,
  h: number,
  minSupport = 0.85,
): Blob[] {
  const best = new Float32Array(w * h);
  // Float64 so the stored scale equals the exact value callers used (and may look up) for each response map.
  const bestSigma = new Float64Array(w * h);
  for (const s of sigmas) {
    const r = responses(s);
    const t = threshold(s);
    for (let i = 0; i < r.length; i++) {
      const v = r[i] / t;
      if (v > best[i]) {
        best[i] = v;
        bestSigma[i] = s;
      }
    }
  }
  // Support: fraction of masked pixels in a window around each candidate.
  const maskF = new Float32Array(w * h);
  for (let i = 0; i < maskF.length; i++) maskF[i] = mask[i];

  const candidates: Blob[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = best[i];
      if (v < 1 || !mask[i]) continue;
      if (
        v < best[i - 1] || v < best[i + 1] || v < best[i - w] || v < best[i + w] ||
        v < best[i - w - 1] || v < best[i - w + 1] || v < best[i + w - 1] || v < best[i + w + 1]
      ) {
        continue;
      }
      candidates.push({ x, y, sigma: bestSigma[i], strength: v });
    }
  }
  if (candidates.length === 0) return [];

  // Check mask support using a blurred mask at the largest scale.
  const supportMap = gaussianBlur(maskF, w, h, Math.max(...sigmas) * 2);
  const supported = candidates.filter((c) => supportMap[c.y * w + c.x] >= minSupport);

  // Greedy non-maximum suppression by distance.
  supported.sort((a, b) => b.strength - a.strength);
  const kept: Blob[] = [];
  for (const c of supported) {
    if (kept.some((k) => Math.hypot(k.x - c.x, k.y - c.y) < 1.5 * Math.max(k.sigma, c.sigma))) continue;
    kept.push(c);
  }
  return kept;
}
