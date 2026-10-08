import type { MetricKey, ScoreBand } from './types';

/**
 * Calibration from raw measurements (physical units, see each metric module)
 * to 0–100 visibility indices.
 *
 * Each metric has five anchors: the raw values that map to scores 0, 25, 50,
 * 75 and 100; scores in between are interpolated linearly. Anchors were set
 * so that the typical value over the reference portraits of the evaluation
 * set lands in the "mild" band (25–49) and the highest observed values land
 * around 75–85, with the lowest anchor at or above a perceptual threshold
 * (see docs/SCORING.md for the observed distribution).
 * They are NOT clinically validated: a score describes how visible a
 * characteristic is in this photo, relative to the reference set, not a
 * medical grade. Re-calibrating = changing these numbers, nothing else.
 */

export const CALIBRATION: Record<MetricKey, { unit: string; anchors: [number, number, number, number, number] }> = {
  redness: { unit: 'a* excess over own baseline, most affected 20% of skin', anchors: [0, 2.5, 5.5, 9, 14] },
  pigmentation: { unit: 'pigment-equivalent ΔL*, most affected 15% of skin', anchors: [0, 0.8, 1.6, 2.6, 4] },
  texture: { unit: 'noise-corrected 0.2–1 mm luminance contrast (%)', anchors: [0.5, 2.2, 3.6, 5.2, 7.5] },
  blemishes: { unit: 'contrast-weighted spots per 10 cm²', anchors: [0, 0.6, 2, 4.5, 9] },
  shine: { unit: '% of skin area with specular highlights (T-zone 60%, cheeks 40%)', anchors: [0, 1.5, 3.5, 6, 10] },
  underEye: { unit: 'ΔL* (upper cheek − under-eye)', anchors: [0, 2.5, 5, 8.5, 13] },
};

export const METHODOLOGY_VERSION = '2.1.0';

export function calibrate(key: MetricKey, raw: number): number {
  const a = CALIBRATION[key].anchors;
  if (raw <= a[0]) return 0;
  if (raw >= a[4]) return 100;
  for (let i = 0; i < 4; i++) {
    if (raw <= a[i + 1]) {
      const t = (raw - a[i]) / (a[i + 1] - a[i]);
      return Math.round(25 * (i + t));
    }
  }
  return 100;
}

export function band(score: number): ScoreBand {
  if (score < 25) return 'minimal';
  if (score < 50) return 'mild';
  if (score < 75) return 'moderate';
  return 'pronounced';
}
