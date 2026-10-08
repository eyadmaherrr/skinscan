import type { AlignedFace } from './alignment';
import { erode } from './image/filters';
import { maskedValues, robustSpread } from './image/stats';
import type { FaceRegions } from './regions';
import { ALL_REGION_KEYS, REGION_KEYS, type RegionKey } from './types';

/**
 * Final skin masks. A pixel is analysed only if:
 *  1. it lies inside a landmark-defined region (eyes, brows and lips excluded),
 *  2. it lies inside the original photo,
 *  3. the segmenter does not confidently label it hair, accessory,
 *     background or clothing (veto-only use of the segmenter, see segmentation.ts),
 *  4. it is not a deep shadow / stray hair (much darker than its region),
 *  5. for colour metrics: it is not clipped (overexposed) or near-black.
 * Masks are eroded slightly so region borders do not contaminate measurements.
 */

export interface SkinMasks {
  /** Usable skin per region (colour + texture metrics). */
  regions: Record<RegionKey, Uint8Array>;
  /** Union of usable regions. */
  all: Uint8Array;
  /** Union including clipped/specular pixels (for shine). */
  allWithHighlights: Uint8Array;
  /** Regions including highlights (for shine). */
  regionsWithHighlights: Record<RegionKey, Uint8Array>;
  /** Geometric region union before filtering (for coverage). */
  geometric: Uint8Array;
  /** Usable fraction per region. */
  coverage: Record<RegionKey, number>;
}

export function buildSkinMasks(face: AlignedFace, regions: FaceRegions): SkinMasks {
  const { width: w, height: h, rgb, lab, seg, valid } = face;
  const n = w * h;
  const veto = new Uint8Array(n);
  const clippedOrDark = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (
      !valid[i] ||
      seg.hair[i] >= 0.5 ||
      seg.others[i] >= 0.5 ||
      seg.background[i] >= 0.6 ||
      seg.clothes[i] >= 0.5
    ) {
      veto[i] = 1;
    }
    const max = Math.max(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    if (max >= 250 || lab.L[i] < 6) clippedOrDark[i] = 1;
  }

  const erodeR = Math.max(1, Math.round(face.pxPerMm * 0.6));
  const out = {} as Record<RegionKey, Uint8Array>;
  const withHighlights = {} as Record<RegionKey, Uint8Array>;
  const coverage = {} as Record<RegionKey, number>;
  const all = new Uint8Array(n);
  const allWithHighlights = new Uint8Array(n);
  const geometric = new Uint8Array(n);

  const core = new Set<RegionKey>(REGION_KEYS);
  for (const key of ALL_REGION_KEYS) {
    const isCore = core.has(key);
    const geo = regions.regions[key];
    const candidate = new Uint8Array(n);
    let geoCount = 0;
    for (let i = 0; i < n; i++) {
      if (!geo[i]) continue;
      geoCount++;
      if (isCore) geometric[i] = 1;
      if (!veto[i]) candidate[i] = 1;
    }
    // Deep shadows and stray hairs: far darker than the region's typical skin.
    const { median: mL, sigma: sL } = robustSpread(maskedValues(lab.L, candidate));
    const darkLimit = mL - Math.max(18, 4 * (sL || 0));
    for (let i = 0; i < n; i++) if (candidate[i] && lab.L[i] < darkLimit) candidate[i] = 0;

    const highlights = erode(candidate, w, h, erodeR);
    const colour = new Uint8Array(n);
    let usable = 0;
    for (let i = 0; i < n; i++) {
      if (highlights[i] && !clippedOrDark[i]) {
        colour[i] = 1;
        usable++;
        if (isCore) all[i] = 1;
      }
      if (highlights[i] && isCore) allWithHighlights[i] = 1;
    }
    out[key] = colour;
    withHighlights[key] = highlights;
    coverage[key] = geoCount ? usable / geoCount : 0;
  }

  return { regions: out, all, allWithHighlights, regionsWithHighlights: withHighlights, geometric, coverage };
}
