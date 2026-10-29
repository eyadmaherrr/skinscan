import type { AlignedFace } from './alignment';
import { estimateNoiseSigma } from './image/filters';
import { median } from './image/stats';
import type { RegionQualityV3 } from './types-v3';
import type { AnatomicalRegionV3 } from './regions-v3';

/**
 * Image quality inside one anatomical zone (reported with the zone, for
 * transparency). Whether a zone gets a score is decided in aggregation-v3.ts
 * from the face-wide measurement and its confidence.
 */
export function assessRegionQuality(
  region: AnatomicalRegionV3,
  face: AlignedFace,
  /** The zone's pixel indices in row-major order, when already known (saves full-image scans). */
  pixels?: Int32Array,
): RegionQualityV3 {
  const { width: w, height: h, rgb, lab, seg } = face;
  const mask = region.mask;
  const zone = pixels ?? Int32Array.from(mask.keys()).filter((i) => mask[i] === 1);

  let totalPixels = 0;
  let clippedCount = 0;
  let crushedCount = 0;
  let accessoryCount = 0;
  let hairCount = 0;
  let usableSkinCount = 0;

  const LValues: number[] = [];

  for (const i of zone) {
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
  // CIE lightness L* back to relative luminance Y (L* > 8).
  const regionY = LValues.length ? median(Float32Array.from(LValues.map((l) => ((l + 16) / 116) ** 3))) : 0;
  const snr = noiseSigma > 0 && regionY > 0 ? regionY / noiseSigma : 40;

  // Local sharpness heuristic: local gradient energy over non-clipped pixels
  let gradSum = 0;
  let gradCount = 0;
  for (const idx of zone) {
    const x = idx % w;
    const y = (idx - x) / w;
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1 || rgb[idx * 3] >= 250) continue;
    const dh = Math.abs(lab.L[idx + 1] - lab.L[idx - 1]);
    const dv = Math.abs(lab.L[idx + w] - lab.L[idx - w]);
    gradSum += dh + dv;
    gradCount++;
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
