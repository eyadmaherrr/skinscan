import { ramp } from './image/stats';
import type { MetricMeasurement } from './metrics/common';
import type { QualityFactors } from './quality';
import type { ConfidenceLabel, MetricKey } from './types';

/**
 * Confidence = how much a reported score can be relied on for THIS photo.
 *
 *   confidence = metric reliability            (method-specific, ≤ cap)
 *              × Π (1 − wᵢ + wᵢ·qᵢ)             (image-quality factors qᵢ ∈ [0,1],
 *                                                 weighted by how much each one
 *                                                 matters for this metric)
 *              × coverage multiplier            (share of the needed skin that was usable)
 *
 * Metrics below MIN_REPORTABLE are not scored ("insufficient confidence").
 */

export const MIN_REPORTABLE = 0.4;

const WEIGHTS: Record<MetricKey, Partial<Record<keyof QualityFactors, number>>> = {
  redness: { exposure: 0.6, lighting: 0.4, pose: 0.2, noise: 0.2 },
  pigmentation: { exposure: 0.5, lighting: 0.6, pose: 0.3, sharpness: 0.2, expression: 0.5 },
  texture: { sharpness: 0.8, resolution: 0.6, noise: 0.5, exposure: 0.3, pose: 0.2, expression: 0.3 },
  blemishes: { sharpness: 0.5, exposure: 0.5, lighting: 0.4, resolution: 0.3, pose: 0.2 },
  shine: { exposure: 0.4, lighting: 0.3, pose: 0.2, sharpness: 0.4 },
  underEye: { lighting: 0.6, exposure: 0.5, pose: 0.4, expression: 0.4 },
};

export function metricConfidence(m: MetricMeasurement, factors: QualityFactors): number {
  if (m.raw === null) return Math.min(0.3, m.reliability);
  let c = m.reliability;
  for (const [factor, weight] of Object.entries(WEIGHTS[m.key]) as [keyof QualityFactors, number][]) {
    c *= 1 - weight + weight * factors[factor];
  }
  c *= 0.4 + 0.6 * ramp(0.25, 0.75, m.coverage);
  return Math.max(0, Math.min(1, c));
}

export function confidenceLabel(c: number): ConfidenceLabel {
  if (c >= 0.75) return 'high';
  if (c >= 0.55) return 'moderate';
  if (c >= MIN_REPORTABLE) return 'low';
  return 'insufficient';
}

/** Overall analysis confidence: average over all metrics, so unreportable metrics pull it down. */
export function overallConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0;
  return confidences.reduce((s, c) => s + c, 0) / confidences.length;
}
