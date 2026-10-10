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

/** Regions used by the core metrics. */
export const REGION_KEYS = [
  'forehead',
  'nose',
  'cheekL',
  'cheekR',
  'chin',
  'underEyeL',
  'underEyeR',
] as const;

/**
 * Auxiliary regions used only by the acne lesion summary (jawline). They are
 * kept out of the core metrics and quality checks so existing scores are unchanged.
 */
export const AUX_REGION_KEYS = ['jawL', 'jawR'] as const;
export const ALL_REGION_KEYS = [...REGION_KEYS, ...AUX_REGION_KEYS] as const;

/** Facial regions. "L"/"R" refer to the left/right side of the image, not of the person. */
export type RegionKey = (typeof ALL_REGION_KEYS)[number];
export type CoreRegionKey = (typeof REGION_KEYS)[number];

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
  /**
   * Extension components (added in methodology 2.1). Each reports its own
   * status and can fail independently without affecting the fields above.
   * Older clients can ignore them.
   */
  acne?: AcneReport;
  pores?: PoreReport;
  /** Skin age (apparent age) estimate (methodology 2.2). */
  skinAge?: SkinAgeReport;
  /**
   * Where each reported core characteristic was most visible: PNG data URIs
   * aligned to the full photo (same aspect ratio), on the same scale as the
   * score (methodology 2.2). Only metrics with a reported score are included.
   */
  heatmaps?: Partial<Record<HeatmapKey, string>>;
  dermFoundation?: DermFoundationReport;
  analysisQuality?: AnalysisQuality;
  /**
   * Region-by-feature anatomical report (methodology 3.5).
   * 24 independent anatomical regions analyzed individually.
   */
  regionsV3?: Record<import('./types-v3').RegionKeyV3, import('./types-v3').RegionReportV3>;
  v3?: import('./types-v3').DetailedV3PipelineResult;
  /** Raw detected face landmarks normalized 0–1 in source photo space. */
  landmarks?: [number, number][];
  /** Skin Type & Visible Oiliness Analysis (Glamour AI ViT + Specular Highlight Analysis) */
  skinType?: SkinTypeReport;
  /** Skin-Tone Uniformity Analysis (CIELAB Regional Segmentation) */
  skinToneUniformity?: SkinToneUniformityReport;
}

export * from './types-v3';

/** Core metrics that have a heatmap. */
export const HEATMAP_KEYS = ['redness', 'pigmentation', 'texture', 'shine'] as const;
export type HeatmapKey = (typeof HEATMAP_KEYS)[number];

/** The skin-age model's nine age ranges, in its output order. */
export const AGE_RANGES = ['0-2', '3-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70+'] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export interface SkinAgeReport {
  status: ComponentStatus;
  /** Most likely apparent-age span in years (one or two adjacent ranges); null unless status is ok. */
  minYears: number | null;
  /** Upper end of the span; null for "70 and over" (or unless status is ok). */
  maxYears: number | null;
  /** The model's probability for that span (0–1). */
  probability: number | null;
  /** The model's probability for each age range. */
  probabilities: Record<AgeRange, number> | null;
  explanation: string;
  limitations: string[];
}

/**
 * ok                    — computed
 * insufficient_quality  — the photo cannot support this estimate (see `limitations`)
 * disabled              — switched off by configuration
 * not_configured        — requires setup (model file / service) that is not present
 * failed                — an internal error; other results are unaffected
 */
export type ComponentStatus = 'ok' | 'insufficient_quality' | 'disabled' | 'not_configured' | 'failed';

/** A spot candidate in normalised source-image coordinates (x, y in 0–1; r as a fraction of image width). */
export interface LesionCandidate {
  x: number;
  y: number;
  r: number;
  /** "red": stands out mainly by redness (active-looking); "dark": mainly darker (a mark, freckle or mole). */
  tone: 'red' | 'dark';
  region: RegionKey | null;
}

export interface RegionCount {
  /** Number of spot candidates in the visible part of the region. */
  count: number;
  /** False when the region was mostly hidden (hair, beard, shadow) and was not assessed. */
  visible: boolean;
}

export interface SeverityComponent {
  status?: ComponentStatus;
  label: string | null;
  probabilities: Record<string, number> | null;
  /** Count of red-toned (inflammatory-looking) spot candidates used by the count grader. */
  inflammatoryLookingSpots?: number;
}

export interface AcneSeverity {
  status: ComponentStatus;
  /** Estimated level ("level0"–"level3"); null unless status is ok. */
  label: string | null;
  /** Human-readable description of the scale. */
  scale: string | null;
  /** Probability per level (combined estimate, or the classifier's softmax when used alone). */
  probabilities: Record<string, number> | null;
  /** Confidence in the estimate (0–1); experimental, capped at moderate. */
  confidence?: number | null;
  confidenceLabel?: ConfidenceLabel | null;
  /** How the estimate was produced. */
  method?: 'combined' | 'count_grader' | 'image_classifier';
  components?: { countGrader: SeverityComponent; imageClassifier: SeverityComponent };
  /** Whether the two models picked the same level (null when only one was available). */
  modelsAgree?: boolean | null;
}

export interface AcneReport {
  /** Status of spot-candidate detection. */
  status: ComponentStatus;
  /** How candidates are found: a contrast/colour spot detector, not a trained lesion detector. */
  method: 'heuristic_spot_detection';
  /** Approximate number of spot candidates (may include freckles, moles or marks). */
  lesionCandidateCount: number | null;
  redToneCount: number | null;
  darkToneCount: number | null;
  lesions: LesionCandidate[];
  regionalSummary: Partial<Record<RegionKey, RegionCount>>;
  severity: AcneSeverity;
  explanation: string;
  limitations: string[];
}

export interface PoreReport {
  status: ComponentStatus;
  /** 0–100 pore-visibility appearance index; not a measurement of pore size. */
  visibilityScore: number | null;
  scoreScale: string;
  confidence: number | null;
  confidenceLabel: ConfidenceLabel | null;
  /** Per-region visibility index (0–100) where the region was assessable. */
  regionalSummary: Partial<Record<RegionKey, number>>;
  /** PNG data URI aligned to the full photo (same aspect ratio), or null. */
  heatmap: string | null;
  explanation: string;
  limitations: string[];
}

export interface DermFoundationReport {
  enabled: boolean;
  featureExtractionStatus: ComponentStatus | 'not_run';
  /** Downstream components that used the embeddings for this result (none are validated yet). */
  downstreamTasks: string[];
}

export interface AnalysisQuality {
  imageQuality: 'acceptable';
  /** Task-specific limitations (e.g. resolution too low for pores). */
  limitations: string[];
}

export type ScanErrorCode =
  | 'unauthenticated'
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

/** Supported classes by the Glamour AI ViT skin classification model (AishaBaliyan/glamour-ai-skin-model). */
export type GlamourSkinTypeClass = 'dry' | 'normal' | 'oily';

export interface SkinTypeReport {
  status: ComponentStatus;
  modelName: string;
  modelVersion: string;
  /** Predicted overall skin type ('dry' | 'normal' | 'oily'). Null if status !== 'ok'. */
  predictedSkinType: GlamourSkinTypeClass | null;
  /** Predicted class probabilities (sums to 1.0). Null if status !== 'ok'. */
  probabilities: Record<GlamourSkinTypeClass, number> | null;
  /** Per-region skin type estimates across suitable facial regions. */
  regionalPredictions?: Partial<Record<'forehead' | 'nose' | 'cheekLeft' | 'cheekRight', {
    predictedType: GlamourSkinTypeClass;
    probabilities: Record<GlamourSkinTypeClass, number>;
  }>>;
  /**
   * Visible shine score (0–100) estimated from surface specular highlights.
   * Kept strictly distinct from the classifier's biological skin-type prediction.
   */
  visibleShine: {
    score: number | null;
    tZoneScore: number | null;
    cheeksScore: number | null;
    regionalBreakdown: Partial<Record<'forehead' | 'nose' | 'cheekLeft' | 'cheekRight', number>>;
  };
  explanation: string;
  limitations: string[];
}

export type FitzpatrickType = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
export type SkinUndertone = 'cool' | 'neutral' | 'warm';

export interface MonkToneMatch {
  number: number;
  name: string;
  hex: string;
  deltaE: number;
  label: string;
}

export interface DetectedSkinTone {
  /** Individual Typology Angle in degrees (ITA) via Sony Research / Chardon formulation */
  ita: number;
  /** Fitzpatrick phototype category (I through VI) */
  fitzpatrick: FitzpatrickType;
  /** Fitzpatrick classification label (e.g., 'Type III') */
  fitzpatrickLabel: string;
  /** Dermatological tone category (e.g. 'Intermediate / Medium') */
  toneLabel: string;
  /** Nearest Monk Skin Tone (MST 1–10) match */
  monk: MonkToneMatch;
  /** Undertone classification based on CIELAB hue angle and chroma ratio */
  undertone: SkinUndertone;
  undertoneLabel: string;
  /** Representative facial skin color as hex string (#rrggbb) */
  hexColor: string;
  /** Facial median CIELAB colorimetry */
  lab: {
    L: number;
    a: number;
    b: number;
  };
  /** Tone hue angle in degrees (0..360) */
  hueAngle: number;
}

export interface RegionalLabMetrics {
  medianL: number;
  medianA: number;
  medianB: number;
  lightnessSpreadIQR: number;
  chromaSpreadIQR: number;
  pixelCount: number;
  ita?: number;
  hexColor?: string;
  deltaEFromBaseline?: number;
  statusLabel?: string;
}

export interface SkinToneUniformityReport {
  status: ComponentStatus;
  experimental: true;
  methodologyVersion: string;
  /** Extracted facial skin tone profile (Fitzpatrick I–VI, Monk 1–10, ITA, undertone, hex swatch) */
  skinTone?: DetectedSkinTone | null;
  /** Normalized 0–100 score (higher = more uniform visible skin tone). Null if insufficient quality or failed. */
  uniformityScore: number | null;
  /** Interpretation band */
  band: 'high' | 'moderate' | 'variable' | null;
  /** Regional CIELAB statistics across key facial anatomical regions */
  regionalMetrics: {
    forehead?: RegionalLabMetrics;
    cheekLeft?: RegionalLabMetrics;
    cheekRight?: RegionalLabMetrics;
    nose?: RegionalLabMetrics;
    chin?: RegionalLabMetrics;
  };
  /** Between-region color distance metrics (Delta E) */
  colorDifferences: {
    leftRightDeltaE: number | null;
    meanInterRegionDeltaE: number | null;
    lightingAsymmetry: number | null;
  };
  /** Coverage and quality stats */
  quality: {
    validSkinPixelCount: number;
    analyzedFraction: number;
    excludedDueToQualityFraction: number;
  };
  /** Delta E spatial heatmap across face (PNG Data URI) */
  heatmap?: string | null;
  warnings: string[];
  explanation: string;
  limitations: string[];
}

