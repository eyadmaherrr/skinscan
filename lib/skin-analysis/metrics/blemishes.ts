import type { AlignedFace } from '../alignment';
import { gaussianBlur } from '../image/filters';
import type { RegionKey } from '../types';
import { detectBlobs, hessianRatio } from './blobs';
import { countPixels, mm2, regionCoverage, union, type MetricContext, type MetricMeasurement } from './common';

/** A detected spot in aligned-crop pixel coordinates. */
export interface Spot {
  x: number;
  y: number;
  /** Detection scale (px); the spot radius is ≈ 1.4·sigma. */
  sigma: number;
  /** Contrast relative to the detection threshold (≥ 1). */
  strength: number;
  /** Whether the spot stands out mainly by being redder or darker than its surroundings. */
  tone: 'red' | 'dark';
  region: RegionKey | null;
}

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
/** Minimum ratio of the smaller to the larger Hessian eigenvalue for a round spot. */
export const MIN_BLOBNESS = 0.3;

/**
 * Blob-likeness of a spot: Hessian eigenvalue ratio of L* (dark spots) or a*
 * (red spots), smoothed at the spot's scale, on a small window around it.
 * Skin folds (smile lines, creases) are shaded *lines*: one eigenvalue is
 * large and the other near zero, so they score near 0; a round spot scores
 * near 1.
 */
export function blobness(face: AlignedFace, s: Pick<Spot, 'x' | 'y' | 'sigma' | 'tone'>): number {
  const plane = s.tone === 'dark' ? face.lab.L : face.lab.a;
  const sign = s.tone === 'dark' ? 1 : -1; // dark spot = local minimum of L*, red spot = local maximum of a*
  const r = Math.ceil(4 * s.sigma) + 2;
  const x0 = Math.max(0, s.x - r);
  const y0 = Math.max(0, s.y - r);
  const x1 = Math.min(face.width - 1, s.x + r);
  const y1 = Math.min(face.height - 1, s.y + r);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w < 5 || h < 5) return 0;
  const patch = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) patch[y * w + x] = sign * plane[(y0 + y) * face.width + x0 + x];
  return hessianRatio(gaussianBlur(patch, w, h, s.sigma), w, h, s.x - x0, s.y - y0);
}

/**
 * Multi-scale spot detector (≈1.5–5 mm, redder or darker than the
 * surrounding skin) restricted to `mask`. Regions are assigned from `regions`.
 * Only blob-like detections are returned: a fold or crease also stands out
 * from the skin around it, but it is a line, not a spot (see `blobness`).
 */
export function detectSpots(
  face: AlignedFace,
  mask: Uint8Array,
  regions: Partial<Record<RegionKey, Uint8Array>>,
): Spot[] {
  const { width: w, height: h } = face;
  const p = face.pxPerMm;
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
  const keys = Object.keys(regions) as RegionKey[];
  return blobs
    .map((b): Spot => {
      const i = b.y * w + b.x;
      return {
        x: b.x,
        y: b.y,
        sigma: b.sigma,
        strength: b.strength,
        tone: redness.get(b.sigma)?.[i] ? 'red' : 'dark',
        region: keys.find((k) => regions[k]?.[i]) ?? null,
      };
    })
    .filter((s) => blobness(face, s) >= MIN_BLOBNESS);
}

export function measureBlemishes(ctx: MetricContext): MetricMeasurement {
  const { face, masks } = ctx;
  const p = face.pxPerMm;
  const mask = union(masks.regions, REGIONS);
  const coverage = regionCoverage(masks, REGIONS);
  const area = countPixels(mask);
  if (area < 500 || p < 1) {
    return { key: 'blemishes', raw: null, regionRaw: {}, coverage, reliability: 0, insufficientReason: 'not_enough_skin', details: {} };
  }
  const regionMasks = Object.fromEntries(REGIONS.map((k) => [k, masks.regions[k]])) as Partial<Record<RegionKey, Uint8Array>>;
  const spots = detectSpots(face, mask, regionMasks);
  ctx.spots = spots;

  let weighted = 0;
  let redCount = 0;
  const regionCounts: Partial<Record<RegionKey, number>> = {};
  for (const s of spots) {
    const wgt = Math.min(1, s.strength / 2);
    weighted += wgt;
    if (s.tone === 'red') redCount++;
    if (s.region) regionCounts[s.region] = (regionCounts[s.region] ?? 0) + wgt;
  }
  const blobs = spots;
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
    scope: mask,
  };
}
