/**
 * Public types of the skin-analysis pipeline. Everything returned by the API
 * is described here; internal measurement types live next to the code that
 * produces them.
 */

export const METRIC_KEYS = [
  'pigmentation',
  'redness',
  'texture',
  'blemishes',
  'shine',
  'underEye',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const REGION_KEYS = [
  'forehead',
  'nose',
  'cheekL',
  'cheekR',
  'chin',
  'underEyeL',
  'underEyeR',
] as const;

/** Facial regions. "L"/"R" refer to the left/right side of the image, not of the person. */
export type RegionKey = (typeof REGION_KEYS)[number];

export type ConfidenceLabel = 'high' | 'moderate' | 'low' | 'insufficient';

/** Score bands. Scores are visibility indices: higher = the characteristic is more visible. */
export type ScoreBand = 'minimal' | 'mild' | 'moderate' | 'pronounced';

export interface MetricResult {
  /** 0–100 visibility index, or null when the measurement was not reliable enough to report. */
  score: number | null;
  band: ScoreBand | null;
  /** 0–1. */
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  /** One or two plain-language sentences. Never a diagnosis. */
  explanation: string;
  /** Regions where the characteristic was most visible (only for reported scores). */
  regions?: RegionKey[];
}

export type QualityIssueCode =
  | 'no_face'
  | 'multiple_faces'
  | 'face_too_small'
  | 'face_cropped'
  | 'face_angle'
  | 'blurry'
  | 'too_dark'
  | 'too_bright'
  | 'uneven_lighting'
  | 'filter_detected'
  | 'not_color'
  | 'sunglasses'
  | 'glasses'
  | 'face_obstructed'
  | 'insufficient_skin';

export interface QualityIssue {
  code: QualityIssueCode;
  message: string;
}

/** Outline of an analysed region, in image coordinates normalised to 0–1. */
export interface RegionOutline {
  region: RegionKey;
  points: [number, number][];
}

export interface ScanSuccess {
  success: true;
  scanId: string;
  createdAt: string;
  analysis: Record<MetricKey, MetricResult>;
  /** 0–1 summary of how much the reported measurements can be relied on. */
  overallConfidence: number;
  imageQuality: {
    acceptable: true;
    /** Non-blocking observations (e.g. "slight shadow on one side"). */
    notes: string[];
  };
  regions: RegionOutline[];
  /** Name and version of the analysis engine. */
  engine: string;
  methodologyVersion: string;
}

export type ScanErrorCode =
  | 'invalid_request'
  | 'unsupported_type'
  | 'file_too_large'
  | 'image_unreadable'
  | 'image_quality'
  | 'rate_limited'
  | 'busy'
  | 'timeout'
  | 'analysis_failed';

export interface ScanFailure {
  success: false;
  error: {
    code: ScanErrorCode;
    message: string;
  };
  imageQuality?: {
    acceptable: false;
    issues: QualityIssue[];
  };
}

export type ScanResponse = ScanSuccess | ScanFailure;
