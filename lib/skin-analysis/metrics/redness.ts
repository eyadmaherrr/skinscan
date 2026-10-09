import { maskedValues, quantiles, ramp, robustSpread } from '../image/stats';
import type { RegionKey } from '../types';
import { cachedBlur, perRegionMean, regionCoverage, topFractionMean, union, type MetricContext, type MetricMeasurement } from './common';

/**
 * Visible redness index.
 *
 * CIELAB a* is the standard colorimetric correlate of erythema (it is what
 * chromameters report as "redness"). In an uncontrolled photo the absolute a*
 * value also depends on the light colour and camera white balance, so the
 * measurement is *relative to the person's own skin*.
 *
 * Shading scales (L*+16) and a* by the same factor, so the ratio
 * a* / (L*+16) is unaffected by lighting and facial shape. Its 20th
 * percentile over the analysed skin is the person's baseline; a pixel's
 * redness excess is the a* it has beyond what that baseline predicts at its
 * lightness. Beyond a 2-unit tolerance (≈ 1 just-noticeable difference),
 * the metric is the mean excess over the most affected 20% of the analysed
 * skin — so redness concentrated on, say, the cheeks is not diluted by the
 * rest of the face.
 *
 * Unit of `raw`: mean a* excess (CIELAB units) over the most affected 20% of skin.
 * Limitation: uniform redness over the whole face cannot be separated from
 * warm lighting and is therefore not captured.
 */

const REGIONS: RegionKey[] = ['forehead', 'nose', 'cheekL', 'cheekR', 'chin'];
const TOLERANCE = 2;
const STRONG = 6;

export function measureRedness(ctx: MetricContext): MetricMeasurement {
  const { face, masks } = ctx;
  const mask = union(masks.regions, REGIONS);
  const aSmooth = cachedBlur(ctx, 'a', face.lab.a, masks.all, 0.5 * face.pxPerMm);
  const LSmooth = cachedBlur(ctx, 'L', face.lab.L, masks.all, 0.5 * face.pxPerMm);
  const ratio = new Float32Array(aSmooth.length);
  for (let i = 0; i < ratio.length; i++) ratio[i] = aSmooth[i] / Math.max(1, LSmooth[i] + 16);
  const values = maskedValues(ratio, mask);
  const coverage = regionCoverage(masks, REGIONS);
  if (values.length < 500) {
    return { key: 'redness', raw: null, regionRaw: {}, coverage, reliability: 0, insufficientReason: 'not_enough_skin', details: {} };
  }
  const [baseline] = quantiles(values, [0.2]);
  const excess = new Float32Array(aSmooth.length);
  let sum = 0;
  let strong = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const e = aSmooth[i] - baseline * (LSmooth[i] + 16);
    const v = Math.min(20, Math.max(0, e - TOLERANCE));
    excess[i] = v;
    sum += v;
    if (e > STRONG) strong++;
    n++;
  }
  // Fine-scale chroma noise (JPEG artefacts, sensor noise) makes a* less trustworthy.
  const residual = new Float32Array(aSmooth.length);
  for (let i = 0; i < residual.length; i++) residual[i] = face.lab.a[i] - aSmooth[i];
  const chromaNoise = robustSpread(maskedValues(residual, mask)).sigma;

  return {
    key: 'redness',
    raw: topFractionMean(maskedValues(excess, mask), 0.2),
    regionRaw: perRegionMean(excess, masks.regions, REGIONS),
    coverage,
    reliability: 0.92 * (0.6 + 0.4 * ramp(5, 1.5, chromaNoise)),
    details: { baselineRatio: baseline, strongFraction: strong / n, meanExcess: sum / n, chromaNoise },
    map: excess,
  };
}
