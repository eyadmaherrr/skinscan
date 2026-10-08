import { maskedGaussianBlur } from '../image/filters';
import type { RegionKey } from '../types';
import { countPixels, union, type MetricContext, type MetricMeasurement } from './common';

/**
 * Visible shine index (surface oiliness proxy).
 *
 * Shine is light reflected directly by the skin surface (specular
 * reflection). Surface reflectance does not depend on melanin, so a specular
 * highlight adds roughly the same amount of light on any skin tone. A pixel
 * counts as a highlight when it is brighter than its local surroundings by a
 * fixed fraction of the scene illumination (estimated from the eye whites),
 * and is less saturated than its surroundings (specular light has the colour
 * of the light source, not of the skin); clipped pixels count when they are
 * also clearly brighter than the surrounding diffuse skin.
 *
 * Shine depends strongly on the lighting (a matte photo can come from diffuse
 * light), so confidence for this metric is capped at "moderate".
 *
 * Unit of `raw`: percentage of analysed skin area showing highlights,
 * weighting the T-zone (forehead, nose) 60% and the cheeks 40%.
 */

const T_ZONE: RegionKey[] = ['forehead', 'nose'];
const CHEEKS: RegionKey[] = ['cheekL', 'cheekR'];

export function measureShine(ctx: MetricContext, illumination: number): MetricMeasurement {
  const { face, masks } = ctx;
  const { width: w, height: h, rgb } = face;
  const p = face.pxPerMm;
  const regions = masks.regionsWithHighlights;
  const all = union(regions, [...T_ZONE, ...CHEEKS]);
  const coverage = [...T_ZONE, ...CHEEKS].reduce((s, k) => s + (countPixels(regions[k]) > 0 ? masks.coverage[k] : 0), 0) / 4;
  if (countPixels(all) < 500) {
    return { key: 'shine', raw: null, regionRaw: {}, coverage, reliability: 0, insufficientReason: 'not_enough_skin', details: {} };
  }
  const { Y, a, b } = face.lab;
  const chroma = new Float32Array(Y.length);
  for (let i = 0; i < chroma.length; i++) chroma[i] = Math.hypot(a[i], b[i]);
  // Diffuse (non-shiny) reference level: a first pass finds obvious highlight
  // candidates, the second pass averages only the remaining skin, so broad
  // highlights do not raise their own reference and hide themselves.
  const firstY = maskedGaussianBlur(Y, all, w, h, 4 * p);
  const diffuse = new Uint8Array(Y.length);
  for (let i = 0; i < Y.length; i++) diffuse[i] = all[i] && Y[i] <= firstY[i] * 1.1 ? 1 : 0;
  const localY = maskedGaussianBlur(Y, diffuse, w, h, 4 * p, firstY);
  const localC = maskedGaussianBlur(chroma, diffuse, w, h, 4 * p);
  const delta = 0.12 * illumination;

  const highlight = new Uint8Array(Y.length);
  for (let i = 0; i < Y.length; i++) {
    if (!all[i]) continue;
    // Fully white (all channels saturated) = clipped highlight; a single saturated channel is just bright skin.
    const clipped = Math.min(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) >= 245;
    const brighter = Y[i] - localY[i] > delta;
    if (brighter && (clipped || chroma[i] < 0.85 * localC[i])) highlight[i] = 1;
  }
  const fraction = (keys: RegionKey[]) => {
    let n = 0;
    let hit = 0;
    for (const k of keys) {
      const m = regions[k];
      for (let i = 0; i < m.length; i++) {
        if (!m[i]) continue;
        n++;
        if (highlight[i]) hit++;
      }
    }
    return n ? (100 * hit) / n : Number.NaN;
  };
  const tZone = fraction(T_ZONE);
  const cheeks = fraction(CHEEKS);
  const raw = Number.isNaN(tZone) ? cheeks : Number.isNaN(cheeks) ? tZone : 0.6 * tZone + 0.4 * cheeks;
  const regionRaw: Partial<Record<RegionKey, number>> = {};
  for (const k of [...T_ZONE, ...CHEEKS]) {
    const f = fraction([k]);
    if (!Number.isNaN(f)) regionRaw[k] = f;
  }
  return {
    key: 'shine',
    raw,
    regionRaw,
    coverage,
    reliability: 0.62,
    details: { tZone, cheeks, illumination },
  };
}
