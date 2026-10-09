import { bandContrast } from '../image/detail';
import { maskedGaussianBlur } from '../image/filters';
import { ramp } from '../image/stats';
import type { RegionKey } from '../types';
import { countPixels, perRegionMean, regionCoverage, union, type MetricContext, type MetricMeasurement } from './common';

/**
 * Visible texture index.
 *
 * Skin micro-relief (fine lines, roughness, unevenness of the surface) shows
 * up in a photo as fine-scale luminance contrast. The metric is the robust
 * amplitude of a band-pass (difference-of-Gaussians, 0.2–1.0 mm) of log
 * luminance — i.e. *relative* (Weber) contrast, which is independent of skin
 * reflectance and therefore of skin tone. Camera noise also adds fine-scale
 * contrast, and adds more of it on darker skin and in dim light, so the noise
 * contribution (estimated with Immerkær's method and propagated through the
 * filter) is subtracted before scoring.
 *
 * Unit of `raw`: band-pass contrast amplitude in percent.
 */

const REGIONS: RegionKey[] = ['forehead', 'cheekL', 'cheekR', 'chin', 'nose'];
export const TEXTURE_MIN_PX_PER_MM = 2.5;

export function measureTexture(ctx: MetricContext): MetricMeasurement {
  const { face, masks, quality } = ctx;
  const p = face.pxPerMm;
  const mask = union(masks.regions, REGIONS);
  const coverage = regionCoverage(masks, REGIONS);
  if (p < TEXTURE_MIN_PX_PER_MM) {
    return { key: 'texture', raw: null, regionRaw: {}, coverage, reliability: 0, insufficientReason: 'low_resolution', details: {} };
  }
  if (countPixels(mask) < 500) {
    return { key: 'texture', raw: null, regionRaw: {}, coverage, reliability: 0, insufficientReason: 'not_enough_skin', details: {} };
  }
  const { width: w, height: h } = face;
  const { band, measured, noise, corrected } = bandContrast(face.lab.logY, mask, w, h, 0.2 * p, 1.0 * p);
  const amplitude = new Float32Array(band.length);
  for (let i = 0; i < band.length; i++) amplitude[i] = Math.abs(band[i]);
  const noiseShare = measured > 0 ? noise / measured : 1;
  // Local amplitude (RMS over ≈1.5 mm) with the same noise correction, for the heatmap.
  const squared = new Float32Array(band.length);
  for (let i = 0; i < band.length; i++) squared[i] = band[i] * band[i];
  const local = maskedGaussianBlur(squared, mask, w, h, 1.5 * p);
  const map = new Float32Array(band.length);
  for (let i = 0; i < map.length; i++) if (mask[i]) map[i] = 100 * Math.sqrt(Math.max(0, local[i] - noise * noise));

  const regionRaw = perRegionMean(amplitude, masks.regions, REGIONS);
  for (const k of Object.keys(regionRaw) as RegionKey[]) regionRaw[k] = (regionRaw[k] as number) * 100;

  return {
    key: 'texture',
    raw: corrected * 100,
    regionRaw,
    coverage,
    // Mostly-noise signals and missing natural detail (filters, heavy compression) lower reliability.
    reliability: 0.88 * ramp(0.95, 0.5, noiseShare) * (0.5 + 0.5 * quality.factors.naturalDetail),
    details: { measured: measured * 100, noise: noise * 100, noiseShare },
    map,
  };
}
