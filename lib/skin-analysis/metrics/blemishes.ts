import { gaussianBlur } from '../image/filters';
import type { RegionKey } from '../types';
import { detectBlobs } from './blobs';
import { countPixels, mm2, regionCoverage, union, type MetricContext, type MetricMeasurement } from './common';

/**
 * Visible blemishes (spot count) index.
 *
 * Counts distinct spot-like marks of roughly 1.5–5 mm that stand out from the
 * surrounding skin either by being redder (a* contrast ≥ 3 units) or darker
 * (L* contrast ≥ 4 units). This is a generic "visible spot" detector: it does
 * not and cannot tell what a spot is (a blemish, a mark, a mole, a freckle) —
 * that requires examination by a dermatologist.
 *
 * Unit of `raw`: contrast-weighted spots per 10 cm² of analysed skin.
 */

const REGIONS: RegionKey[] = ['forehead', 'cheekL', 'cheekR', 'chin', 'nose'];
const RED_CONTRAST = 3;
const DARK_CONTRAST = 4;

export function measureBlemishes(ctx: MetricContext): MetricMeasurement {
  const { face, masks } = ctx;
  const { width: w, height: h } = face;
  const p = face.pxPerMm;
  const mask = union(masks.regions, REGIONS);
  const coverage = regionCoverage(masks, REGIONS);
  const area = countPixels(mask);
  if (area < 500 || p < 1) {
    return { key: 'blemishes', raw: null, regionRaw: {}, coverage, reliability: 0, insufficientReason: 'not_enough_skin', details: {} };
  }
  const sigmas = [0.6 * p, 1.0 * p, 1.5 * p];
  const cacheL = new Map<number, Float32Array>();
  const cacheA = new Map<number, Float32Array>();
  const blur = (cache: Map<number, Float32Array>, src: Float32Array, s: number) => {
    let b = cache.get(s);
    if (!b) {
      b = gaussianBlur(src, w, h, s);
      cache.set(s, b);
    }
    return b;
  };
  // Combined response: the stronger of "darker than surroundings" and "redder than surroundings",
  // each expressed relative to its contrast threshold. DoG peak ≈ 0.5× blob contrast at matched scale.
  const redness = new Map<number, Float32Array>();
  const responses = (s: number) => {
    const Li = blur(cacheL, face.lab.L, s);
    const Lo = blur(cacheL, face.lab.L, s * 1.6);
    const Ai = blur(cacheA, face.lab.a, s);
    const Ao = blur(cacheA, face.lab.a, s * 1.6);
    const r = new Float32Array(Li.length);
    const red = new Float32Array(Li.length);
    for (let i = 0; i < r.length; i++) {
      const dark = (Lo[i] - Li[i]) / (0.5 * DARK_CONTRAST);
      const rd = (Ai[i] - Ao[i]) / (0.5 * RED_CONTRAST);
      r[i] = Math.max(dark, rd);
      red[i] = rd >= dark ? 1 : 0;
    }
    redness.set(s, red);
    return r;
  };
  const blobs = detectBlobs(responses, sigmas, () => 1, mask, w, h, 0.85);

  let weighted = 0;
  let redCount = 0;
  const regionCounts: Partial<Record<RegionKey, number>> = {};
  for (const b of blobs) {
    const wgt = Math.min(1, b.strength / 2);
    weighted += wgt;
    if (redness.get(b.sigma)?.[b.y * w + b.x]) redCount++;
    for (const k of REGIONS) {
      if (masks.regions[k][b.y * w + b.x]) {
        regionCounts[k] = (regionCounts[k] ?? 0) + wgt;
        break;
      }
    }
  }
  const per10cm2 = (count: number, px: number) => count / (mm2(px, p) / 1000);
  const regionRaw: Partial<Record<RegionKey, number>> = {};
  for (const k of REGIONS) {
    const a = countPixels(masks.regions[k]);
    if (a > 200) regionRaw[k] = per10cm2(regionCounts[k] ?? 0, a);
  }
  return {
    key: 'blemishes',
    raw: per10cm2(weighted, area),
    regionRaw,
    coverage,
    reliability: 0.8,
    details: { count: blobs.length, redCount, darkCount: blobs.length - redCount, areaCm2: mm2(area, p) / 100 },
  };
}
