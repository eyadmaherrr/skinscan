import type { ConfidenceLabel, MetricKey, RegionKey, ScoreBand } from './types';

/** Display labels shared by the API explanations and the UI. */
export const METRIC_LABELS: Record<MetricKey, string> = {
  pigmentation: 'Uneven pigmentation',
  redness: 'Visible redness',
  texture: 'Skin texture',
  blemishes: 'Visible spots & blemishes',
  shine: 'Shine',
  underEye: 'Under-eye darkness',
};

export const BAND_LABELS: Record<ScoreBand, string> = {
  minimal: 'Minimal',
  mild: 'Mild',
  moderate: 'Moderate',
  pronounced: 'Pronounced',
};

export const CONFIDENCE_LABELS: Record<ConfidenceLabel, string> = {
  high: 'High confidence',
  moderate: 'Moderate confidence',
  low: 'Low confidence',
  insufficient: 'Insufficient confidence',
};

export const REGION_LABELS: Record<RegionKey, string> = {
  forehead: 'Forehead',
  nose: 'Nose',
  cheekL: 'Cheek',
  cheekR: 'Cheek',
  chin: 'Chin',
  underEyeL: 'Under-eye',
  underEyeR: 'Under-eye',
  jawL: 'Jawline',
  jawR: 'Jawline',
};
