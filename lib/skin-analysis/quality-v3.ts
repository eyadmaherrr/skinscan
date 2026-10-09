import type { AlignedFace } from './alignment';
import { estimateNoiseSigma } from './image/filters';
import { median } from './image/stats';
import type {
  FeatureKeyV3,
  RegionKeyV3,
  RegionQualityV3,
  RegionUnavailableReason,
} from './types-v3';
import type { AnatomicalRegionV3 } from './regions-v3';

/**
 * Assesses image quality strictly within an individual anatomical region.
 * Enables granular feature gating: a region with strong glare or hair occlusion
 * is marked unavailable for specific measurements without failing the entire photo.
 */
export function assessRegionQuality(
  region: AnatomicalRegionV3,
  face: AlignedFace,
): RegionQualityV3 {
  const { width: w, height: h, rgb, lab, seg } = face;
  const mask = region.mask;

  let totalPixels = 0;
  let clippedCount = 0;
  let crushedCount = 0;
  let accessoryCount = 0;
  let hairCount = 0;
  let usableSkinCount = 0;

  const LValues: number[] = [];

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    totalPixels++;

    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const maxRgb = Math.max(r, g, b);

    if (maxRgb >= 250) clippedCount++;
    if (maxRgb <= 12) crushedCount++;

    if (seg.others[i] >= 0.4) accessoryCount++;
    if (seg.hair[i] >= 0.5) hairCount++;

    const isSkin =
      seg.faceSkin[i] >= 0.3 &&
      seg.hair[i] < 0.5 &&
      seg.others[i] < 0.4 &&
      seg.background[i] < 0.6 &&
      seg.clothes[i] < 0.5;

    if (isSkin && maxRgb > 12 && maxRgb < 250) {
      usableSkinCount++;
      LValues.push(lab.L[i]);
    }
  }

  if (totalPixels === 0) {
    return {
      sharpness: 0,
      clippedFraction: 0,
      crushedFraction: 0,
      medianL: 0,
      snr: 0,
      accessoryFraction: 0,
      hairFraction: 0,
      usableCoverage: 0,
    };
  }

  const clippedFraction = clippedCount / totalPixels;
  const crushedFraction = crushedCount / totalPixels;
  const accessoryFraction = accessoryCount / totalPixels;
  const hairFraction = hairCount / totalPixels;
  const usableCoverage = usableSkinCount / totalPixels;

  const medianL = LValues.length ? median(Float32Array.from(LValues)) : 0;

  // Local noise and SNR within region
  const noiseSigma = estimateNoiseSigma(lab.Y, mask, w, h);
  const regionY = LValues.length ? median(Float32Array.from(LValues.map((l) => (l / 100) ** 2.2))) : 0;
  const snr = noiseSigma > 0 && regionY > 0 ? regionY / noiseSigma : 40;

  // Local sharpness heuristic: local gradient energy over non-clipped pixels
  let gradSum = 0;
  let gradCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (!mask[idx] || rgb[idx * 3] >= 250) continue;
      const dh = Math.abs(lab.L[idx + 1] - lab.L[idx - 1]);
      const dv = Math.abs(lab.L[idx + w] - lab.L[idx - w]);
      gradSum += dh + dv;
      gradCount++;
    }
  }
  const meanGrad = gradCount > 0 ? gradSum / gradCount : 0;
  // Normalized to [0, 1] relative to typical facial detail gradients
  const sharpness = Math.min(1, Math.max(0, meanGrad / 6.0));

  return {
    sharpness,
    clippedFraction,
    crushedFraction,
    medianL,
    snr,
    accessoryFraction,
    hairFraction,
    usableCoverage,
  };
}

/**
 * Validates whether a specific feature can be reliably measured in a given region.
 * Returns null if suitable, or a specific RegionUnavailableReason if the measurement must be withheld.
 */
export function checkFeatureFeasibility(
  feature: FeatureKeyV3,
  regionKey: RegionKeyV3,
  quality: RegionQualityV3,
  pxPerMm: number,
): RegionUnavailableReason | null {
  // Common gate: minimum usable skin
  if (quality.usableCoverage < 0.25) return 'insufficient_skin';
  if (quality.hairFraction > 0.6) return 'occluded_by_hair';
  if (quality.accessoryFraction > 0.45) return 'occluded_by_glasses';

  switch (feature) {
    case 'texture':
      if (pxPerMm < 2.0) return 'low_resolution';
      if (quality.sharpness < 0.15) return 'blurry';
      if (quality.clippedFraction > 0.3) return 'overexposed';
      break;

    case 'shine':
      if (quality.clippedFraction > 0.4) return 'overexposed';
      if (quality.crushedFraction > 0.4) return 'underexposed';
      break;

    case 'redness':
    case 'pigmentation':
      if (quality.clippedFraction > 0.35) return 'overexposed';
      if (quality.crushedFraction > 0.35) return 'underexposed';
      if (quality.snr < 6) return 'underexposed';
      break;

    case 'underEye':
      if (regionKey !== 'underEyeLeft' && regionKey !== 'underEyeRight') return 'not_visible';
      if (quality.crushedFraction > 0.5) return 'underexposed';
      break;

    case 'pores':
      if (pxPerMm < 4.5) return 'low_resolution';
      if (quality.sharpness < 0.3) return 'blurry';
      break;

    case 'blemishes':
      if (pxPerMm < 1.5) return 'low_resolution';
      break;
  }

  return null;
}
