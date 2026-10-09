import type { ConfidenceLabel, ScoreBand } from './types';

/**
 * All 24 canonical anatomical regions in Dr Maher Vision AI v3.0.
 * Every region is tracked, masked, and analyzed independently.
 */
export const ANATOMICAL_REGION_KEYS_V3 = [
  // Forehead, Temples & Glabella
  'foreheadCenter',
  'foreheadLeft',
  'foreheadRight',
  'templeLeft',
  'templeRight',
  'glabella',

  // Periocular
  'upperEyeLeft',
  'upperEyeRight',
  'underEyeLeft',
  'underEyeRight',

  // Nose
  'noseBridge',
  'noseTip',
  'nasalSidewallLeft',
  'nasalSidewallRight',
  'alarSkinLeft',
  'alarSkinRight',

  // Cheeks
  'cheekLeft',
  'cheekRight',

  // Perioral
  'perioralUpper',
  'perioralLower',
  'perioralLeft',
  'perioralRight',

  // Chin
  'chinCenter',
  'chinLeft',
  'chinRight',

  // Jawline
  'jawlineLeft',
  'jawlineRight',
] as const;

export type RegionKeyV3 = (typeof ANATOMICAL_REGION_KEYS_V3)[number];

export const FEATURE_KEYS_V3 = [
  'pigmentation',
  'redness',
  'texture',
  'blemishes',
  'shine',
  'underEye',
  'pores',
] as const;

export type FeatureKeyV3 = (typeof FEATURE_KEYS_V3)[number];

export type FeatureStatusV3 =
  | 'measured'
  | 'low_quality'
  | 'unavailable'
  | 'not_supported'
  | 'processing_error';

export type RegionStatusV3 =
  | 'usable'
  | 'low_quality'
  | 'occluded'
  | 'insufficient_skin'
  | 'unavailable';

export type RegionUnavailableReason =
  | 'insufficient_skin'
  | 'occluded_by_hair'
  | 'occluded_by_glasses'
  | 'occluded_by_covering'
  | 'low_resolution'
  | 'blurry'
  | 'overexposed'
  | 'underexposed'
  | 'uneven_lighting'
  | 'not_visible';

export interface RegionQualityV3 {
  /** Local sharpness relative to face standard (0–1). */
  sharpness: number;
  /** Fraction of region with overexposed/clipped pixels (0–1). */
  clippedFraction: number;
  /** Fraction of region with crushed/shadow pixels (0–1). */
  crushedFraction: number;
  /** Median L* in region. */
  medianL: number;
  /** Local Signal-to-Noise Ratio (dB or linear ratio). */
  snr: number;
  /** Fraction vetoed by accessory / glasses (0–1). */
  accessoryFraction: number;
  /** Fraction vetoed by hair (0–1). */
  hairFraction: number;
  /** Usable skin coverage (usable skin / total anatomical area). */
  usableCoverage: number;
}

export interface RegionFeatureResultV3 {
  feature: FeatureKeyV3;
  status: FeatureStatusV3;
  /** Raw physical or photometric measurement. */
  raw: number | null;
  /** Calibrated 0–100 visibility index (null if unmeasured or unreliable). */
  score: number | null;
  band: ScoreBand | null;
  /** Local confidence (0–1). */
  confidence: number | null;
  confidenceLabel: ConfidenceLabel | null;
  unit?: string;
  calibrationStatus: 'calibrated' | 'provisional' | 'experimental';
  warnings: string[];
  unavailableReason?: RegionUnavailableReason;
  details?: Record<string, number | string | boolean>;
}

export interface RegionReportV3 {
  key: RegionKeyV3;
  nameEn: string;
  nameAr: string;
  status: RegionStatusV3;
  /** Total pixels in aligned crop for this anatomical region. */
  pixelCount: number;
  /** Count of valid, non-occluded skin pixels analyzed. */
  usableSkinPixels: number;
  /** Usable skin fraction (0–1). */
  skinCoverage: number;
  /** Estimated physical surface area in mm² based on face IOD. */
  areaMm2: number;
  /** Local quality metrics evaluated strictly within this region. */
  quality: RegionQualityV3;
  /** Measurements for each supported feature within this region. */
  features: Partial<Record<FeatureKeyV3, RegionFeatureResultV3>>;
  /** Normalized outline coordinates [x, y] in original photo space (0–1). */
  outline: [number, number][];
  /** Alias for outline (normalized coordinates 0–1 in source photo space). */
  outlineSource?: [number, number][];
  unavailableReasons: RegionUnavailableReason[];
}


export interface FeatureSummaryV3 {
  feature: FeatureKeyV3;
  status: FeatureStatusV3;
  overallScore: number | null;
  overallBand: ScoreBand | null;
  overallConfidence: number;
  overallConfidenceLabel: ConfidenceLabel;
  prominentRegions: RegionKeyV3[];
  measuredRegionCount: number;
  totalRegionCount: number;
}

export interface DetailedV3PipelineResult {
  engineVersion: '3.5.0';
  methodologyVersion: '3.5.0';
  imageQuality: {
    acceptable: boolean;
    issues: string[];
    notes: string[];
  };
  faceGeometry: {
    iodPx: number;
    pxPerMm: number;
    yaw: number;
    pitch: number;
    roll: number;
    landmarks?: [number, number][];
    boundingBox?: [number, number, number, number];
  };
  regions: Record<RegionKeyV3, RegionReportV3>;

  featureSummaries: Record<FeatureKeyV3, FeatureSummaryV3>;
  executionMs: number;
}

/** Names dictionary in English and Arabic for all 24 anatomical regions. */
export const ANATOMICAL_REGION_NAMES: Record<RegionKeyV3, { en: string; ar: string }> = {
  foreheadCenter: { en: 'Central Forehead', ar: 'منتصف الجبهة' },
  foreheadLeft: { en: 'Left Forehead', ar: 'الجبهة اليسرى' },
  foreheadRight: { en: 'Right Forehead', ar: 'الجبهة اليمنى' },
  templeLeft: { en: 'Left Temple', ar: 'الصدغ الأيسر' },
  templeRight: { en: 'Right Temple', ar: 'الصدغ الأيمن' },
  glabella: { en: 'Glabella', ar: 'ما بين الحاجبين' },
  upperEyeLeft: { en: 'Left Upper Eyelid', ar: 'جفن العين الأيسر العلوي' },
  upperEyeRight: { en: 'Right Upper Eyelid', ar: 'جفن العين الأيمن العلوي' },
  underEyeLeft: { en: 'Left Under-Eye', ar: 'أسفل العين اليسرى' },
  underEyeRight: { en: 'Right Under-Eye', ar: 'أسفل العين اليمنى' },
  noseBridge: { en: 'Nose Bridge', ar: 'جسر الأنف' },
  noseTip: { en: 'Nose Tip', ar: 'أرنبة الأنف' },
  nasalSidewallLeft: { en: 'Left Nasal Sidewall', ar: 'جانب الأنف الأيسر' },
  nasalSidewallRight: { en: 'Right Nasal Sidewall', ar: 'جانب الأنف الأيمن' },
  alarSkinLeft: { en: 'Left Alar Skin', ar: 'جناح الأنف الأيسر' },
  alarSkinRight: { en: 'Right Alar Skin', ar: 'جناح الأنف الأيمن' },
  cheekLeft: { en: 'Left Cheek', ar: 'الخد الأيسر' },
  cheekRight: { en: 'Right Cheek', ar: 'الخد الأيمن' },
  perioralUpper: { en: 'Upper Perioral Skin', ar: 'أعلى الشفة العليا' },
  perioralLower: { en: 'Lower Perioral Skin', ar: 'أسفل الشفة السفلى' },
  perioralLeft: { en: 'Left Perioral Skin', ar: 'محيط الفم الأيسر' },
  perioralRight: { en: 'Right Perioral Skin', ar: 'محيط الفم الأيمن' },
  chinCenter: { en: 'Central Chin', ar: 'منتصف الذقن' },
  chinLeft: { en: 'Left Chin', ar: 'الجانب الأيسر للذقن' },
  chinRight: { en: 'Right Chin', ar: 'الجانب الأيمن للذقن' },
  jawlineLeft: { en: 'Left Jawline', ar: 'خط الفك الأيسر' },
  jawlineRight: { en: 'Right Jawline', ar: 'خط الفك الأيمن' },
};
