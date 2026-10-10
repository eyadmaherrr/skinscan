import type { AlignedFace } from '../alignment';
import type { RgbImage } from '../image/decode';
import { robustSpread } from '../image/stats';
import type { MetricContext } from '../metrics/common';
import { PALETTES, renderHeatmap } from './projection';
import { analysisText } from '../text';
import type {
  DetectedSkinTone,
  FitzpatrickType,
  MonkToneMatch,
  RegionalLabMetrics,
  RegionKey,
  SkinToneUniformityReport,
  SkinUndertone,
} from '../types';

/**
 * Skin-Tone & Uniformity Analysis Engine (Dr Maher Vision AI v3.5).
 *
 * Describes skin colour with ITA (Chardon 1991; categories of Del Bino et al.), hue angle
 * (Thong, Joniak, Xiang — Sony AI, ICCV 2023) and the nearest Monk Skin Tone swatch,
 * combined with anatomical regional color consistency evaluation across canonical
 * facial zones: Forehead, Left Cheek, Right Cheek, Nose, and Chin.
 *
 * Methodology:
 *  1. Non-skin veto: Reuses anatomical masks, strictly excluding eyes,
 *     eyebrows, lips, nostrils, hair, clothing, and background.
 *  2. Quality filtration: Excludes specular reflections / clipping (max RGB >= 248
 *     or L* >= 95) and deep occluding shadows (L* <= 12).
 *  3. CIELAB colorimetry: Standard CIELAB (D65) color space.
 *  4. Skin-colour description (Chardon 1991 / Thong et al. 2023):
 *     - Individual Typology Angle: ITA = (180 / π) * arctan((L* - 50) / b*)
 *     - ITA colour category (the Fitzpatrick-style label is kept in the API for
 *       compatibility but is not shown: phototype is a UV response, not a colour)
 *     - Monk Skin Tone (MST 1–10) scale nearest perceptual match
 *     - Skin undertone (cool / neutral / warm) from hue angle & chroma ratio
 *     - True sRGB color swatch from facial skin pixels
 *  5. Robust regional statistics: Computes median L*, a*, b*, interquartile
 *     lightness variation (IQR), and chroma spread per anatomical zone.
 *  6. Inter-region perceptual color distance: Evaluates pairwise Delta E*ab
 *     relative to facial baseline color.
 *  7. Lighting asymmetry gating: Detects directional lighting differences
 *     between left and right cheeks to avoid penalizing asymmetric shadows.
 *  8. Normalized 0–100 score: exponential mapping of the regional colour
 *     differences (not yet validated across skin tones).
 *  9. Spatial Delta E deviation heatmap across facial skin.
 */

export const UNIFORMITY_METHODOLOGY_VERSION = '3.5.0';

export interface UniformityAnalysisOptions {
  enabled: boolean;
  locale?: 'en' | 'ar';
}

/**
 * Monk Skin Tone (MST 1–10) calibrated standards in CIELAB (D65) and sRGB Hex.
 * Developed by Dr. Ellis Monk (released by Google under CC BY 4.0).
 */
export const MONK_SCALE_TONES = [
  { number: 1, name: 'Monk 01', hex: '#f6ede4', L: 94.3, a: 2.5, b: 5.5, labelEn: 'Very Light', labelAr: 'شديدة البياض' },
  { number: 2, name: 'Monk 02', hex: '#f3e7db', L: 92.1, a: 3.1, b: 7.6, labelEn: 'Fair', labelAr: 'فاتحة جداً' },
  { number: 3, name: 'Monk 03', hex: '#f7ead0', L: 92.9, a: 1.4, b: 14.1, labelEn: 'Light', labelAr: 'فاتحة' },
  { number: 4, name: 'Monk 04', hex: '#eadaba', L: 87.8, a: 2.8, b: 17.5, labelEn: 'Medium Light', labelAr: 'حنطية فاتحة' },
  { number: 5, name: 'Monk 05', hex: '#d7bd96', L: 77.3, a: 6.5, b: 22.8, labelEn: 'Medium / Olive', labelAr: 'قمحية / متوسطة' },
  { number: 6, name: 'Monk 06', hex: '#a07e56', L: 55.4, a: 10.4, b: 26.3, labelEn: 'Tan / Amber', labelAr: 'حنطية داكنة / برونزية' },
  { number: 7, name: 'Monk 07', hex: '#825c43', L: 42.6, a: 13.5, b: 21.0, labelEn: 'Warm Brown', labelAr: 'سمراء دافئة' },
  { number: 8, name: 'Monk 08', hex: '#604134', L: 31.4, a: 12.3, b: 14.2, labelEn: 'Deep Brown', labelAr: 'سمراء داكنة' },
  { number: 9, name: 'Monk 09', hex: '#3a312a', L: 22.4, a: 4.8, b: 6.2, labelEn: 'Dark', labelAr: 'داكنة' },
  { number: 10, name: 'Monk 10', hex: '#292420', L: 16.2, a: 3.0, b: 4.0, labelEn: 'Very Dark', labelAr: 'شديدة السمرة' },
] as const;

/** Standard Delta E (CIE 1976 Euclidean distance in CIELAB space). */
export function deltaE76(
  L1: number,
  a1: number,
  b1: number,
  L2: number,
  a2: number,
  b2: number,
): number {
  const dL = L1 - L2;
  const da = a1 - a2;
  const db = b1 - b2;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/** Robust median and interquartile range (IQR) for a float array. */
export function computeRobustQuantiles(values: number[]): {
  median: number;
  iqr: number;
} {
  if (!values.length) return { median: 0, iqr: 0 };
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const q25 = sorted[Math.floor(n * 0.25)];
  const q50 = n % 2 === 1 ? sorted[Math.floor(n * 0.5)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const q75 = sorted[Math.floor(n * 0.75)];
  const iqr = Math.max(0, q75 - q25);
  return { median: Math.round(q50 * 100) / 100, iqr: Math.round(iqr * 100) / 100 };
}

/**
 * Calculates the Individual Typology Angle (ITA) in degrees.
 * Formulated by Chardon et al. (1991):
 * ITA = (180 / π) * arctan((L* - 50) / b*)
 */
export function computeITA(L: number, b: number): number {
  if (Math.abs(b) < 1e-4) {
    return L >= 50 ? 90 : -90;
  }
  const rad = Math.atan((L - 50) / b);
  return Math.round(((rad * 180) / Math.PI) * 10) / 10;
}

/**
 * Maps the Individual Typology Angle (ITA) to its colour category. The phototype
 * label is an approximate correspondence only and is not shown to users.
 * Reference dermatological thresholds (Chardon 1991, Del Bino 2018, Kinyanjui et al. 2020):
 *   ITA > 55°       -> Type I (Very Light / Fair)
 *   41° < ITA <= 55° -> Type II (Light)
 *   28° < ITA <= 41° -> Type III (Intermediate / Medium)
 *   10° < ITA <= 28° -> Type IV (Tan / Olive)
 *  -30° < ITA <= 10° -> Type V (Brown / Deep)
 *   ITA <= -30°      -> Type VI (Dark / Deeply Pigmented)
 */
export function determineFitzpatrick(
  ita: number,
  locale: 'en' | 'ar' = 'en',
): {
  type: FitzpatrickType;
  fitzpatrickLabel: string;
  toneLabel: string;
} {
  const isAr = locale === 'ar';
  if (ita > 55) {
    return {
      type: 'I',
      fitzpatrickLabel: isAr ? 'النمط الأول (Type I)' : 'Fitzpatrick Type I',
      toneLabel: isAr ? 'شديدة البياض / فاتحة جداً' : 'Very Light / Fair',
    };
  }
  if (ita > 41) {
    return {
      type: 'II',
      fitzpatrickLabel: isAr ? 'النمط الثاني (Type II)' : 'Fitzpatrick Type II',
      toneLabel: isAr ? 'فاتحة' : 'Light',
    };
  }
  if (ita > 28) {
    return {
      type: 'III',
      fitzpatrickLabel: isAr ? 'النمط الثالث (Type III)' : 'Fitzpatrick Type III',
      toneLabel: isAr ? 'متوسطة / قمحية' : 'Intermediate / Medium',
    };
  }
  if (ita > 10) {
    return {
      type: 'IV',
      fitzpatrickLabel: isAr ? 'النمط الرابع (Type IV)' : 'Fitzpatrick Type IV',
      toneLabel: isAr ? 'حنطية / زيتونية' : 'Tan / Olive',
    };
  }
  if (ita > -30) {
    return {
      type: 'V',
      fitzpatrickLabel: isAr ? 'النمط الخامس (Type V)' : 'Fitzpatrick Type V',
      toneLabel: isAr ? 'سمراء / داكنة' : 'Brown / Deep',
    };
  }
  return {
    type: 'VI',
    fitzpatrickLabel: isAr ? 'النمط السادس (Type VI)' : 'Fitzpatrick Type VI',
    toneLabel: isAr ? 'شديدة السمرة' : 'Dark / Deeply Pigmented',
  };
}

/** Finds the nearest Monk Skin Tone (MST 1–10) match via minimal Delta E 1976. */
export function matchMonkScale(
  L: number,
  a: number,
  b: number,
  locale: 'en' | 'ar' = 'en',
): MonkToneMatch {
  let best: (typeof MONK_SCALE_TONES)[number] = MONK_SCALE_TONES[0];
  let minDiff = Number.POSITIVE_INFINITY;
  for (const tone of MONK_SCALE_TONES) {
    const dE = deltaE76(L, a, b, tone.L, tone.a, tone.b);
    if (dE < minDiff) {
      minDiff = dE;
      best = tone;
    }
  }
  return {
    number: best.number,
    name: best.name,
    hex: best.hex,
    deltaE: Math.round(minDiff * 100) / 100,
    label: locale === 'ar' ? best.labelAr : best.labelEn,
  };
}

/** Evaluates skin undertone from CIELAB hue angle and chroma ratio. */
export function determineUndertone(
  a: number,
  b: number,
  locale: 'en' | 'ar' = 'en',
): {
  undertone: SkinUndertone;
  undertoneLabel: string;
  hueAngle: number;
} {
  const rad = Math.atan2(b, a);
  const deg = (rad * 180) / Math.PI;
  const hueAngle = Math.round(((deg >= 0 ? deg : deg + 360) % 360) * 10) / 10;
  const isAr = locale === 'ar';

  const ratio = a > 0 ? b / a : 1.5;
  if (hueAngle < 54 || ratio < 1.25) {
    return {
      undertone: 'cool',
      undertoneLabel: isAr ? 'باردة (مائلة للوردي)' : 'Cool (Rosy / Pinkish)',
      hueAngle,
    };
  }
  if (hueAngle > 65 || ratio > 1.85) {
    return {
      undertone: 'warm',
      undertoneLabel: isAr ? 'دافئة (مائلة للذهبي / الخوخي)' : 'Warm (Golden / Peachy)',
      hueAngle,
    };
  }
  return {
    undertone: 'neutral',
    undertoneLabel: isAr ? 'محايدة (متوازنة)' : 'Neutral (Balanced)',
    hueAngle,
  };
}

/** Formats byte numbers to hex string #rrggbb. */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

/** Converts CIELAB (D65) values to standard sRGB tuple. */
export function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const delta = 6 / 29;
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;

  const x = fx > delta ? fx * fx * fx : (fx - 16 / 116) * 3 * delta * delta;
  const y = fy > delta ? fy * fy * fy : (fy - 16 / 116) * 3 * delta * delta;
  const z = fz > delta ? fz * fz * fz : (fz - 16 / 116) * 3 * delta * delta;

  const X = x * xn;
  const Y = y * yn;
  const Z = z * zn;

  // sRGB linear matrix
  const rl = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  const gl = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const bl = 0.0557 * X - 0.204 * Y + 1.057 * Z;

  // Gamma companding
  const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055);

  return [
    Math.max(0, Math.min(255, Math.round(gamma(rl) * 255))),
    Math.max(0, Math.min(255, Math.round(gamma(gl) * 255))),
    Math.max(0, Math.min(255, Math.round(gamma(bl) * 255))),
  ];
}

/** Extract valid, non-clipped skin pixel indices for a given region mask. */
function extractValidRegionPixels(
  face: AlignedFace,
  regionMask: Uint8Array,
): { validIndices: number[]; excludedCount: number; totalCount: number } {
  const { width: w, height: h, rgb, lab } = face;
  const n = w * h;
  const validIndices: number[] = [];
  let excludedCount = 0;
  let totalCount = 0;

  for (let i = 0; i < n; i++) {
    if (!regionMask[i]) continue;
    totalCount++;

    const maxRgb = Math.max(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    const L = lab.L[i];

    // Exclude overexposed/clipped highlights or deep shadow outliers
    if (maxRgb >= 248 || L >= 95 || L <= 12) {
      excludedCount++;
      continue;
    }

    validIndices.push(i);
  }

  return { validIndices, excludedCount, totalCount };
}

/**
 * Calculates Skin-Tone Uniformity report from aligned face and skin masks.
 */
export async function analyzeSkinToneUniformity(
  ctx: MetricContext,
  image: RgbImage,
  options: UniformityAnalysisOptions = { enabled: true },
): Promise<SkinToneUniformityReport> {
  const text = analysisText(ctx.locale);
  const { face, masks } = ctx;
  const { lab, width: w, height: h } = face;

  if (!options.enabled) {
    return {
      status: 'disabled',
      experimental: true,
      methodologyVersion: UNIFORMITY_METHODOLOGY_VERSION,
      skinTone: null,
      uniformityScore: null,
      band: null,
      regionalMetrics: {},
      colorDifferences: {
        leftRightDeltaE: null,
        meanInterRegionDeltaE: null,
        lightingAsymmetry: null,
      },
      quality: {
        validSkinPixelCount: 0,
        analyzedFraction: 0,
        excludedDueToQualityFraction: 0,
      },
      heatmap: null,
      warnings: [],
      explanation: text.skinToneUniformity.disabled,
      limitations: text.skinToneUniformity.limitations,
    };
  }

  const regionDefinitions: Array<{
    key: 'forehead' | 'cheekLeft' | 'cheekRight' | 'nose' | 'chin';
    maskKey: RegionKey;
  }> = [
    { key: 'forehead', maskKey: 'forehead' },
    { key: 'cheekLeft', maskKey: 'cheekL' },
    { key: 'cheekRight', maskKey: 'cheekR' },
    { key: 'nose', maskKey: 'nose' },
    { key: 'chin', maskKey: 'chin' },
  ];

  const regionalMetrics: SkinToneUniformityReport['regionalMetrics'] = {};
  const regionPixelLists: Record<string, number[]> = {};
  let totalValidPixels = 0;
  let totalExcludedPixels = 0;
  let totalGeometricPixels = 0;

  for (const def of regionDefinitions) {
    const mask = masks.regions[def.maskKey];
    if (!mask) continue;

    const { validIndices, excludedCount, totalCount } = extractValidRegionPixels(face, mask);
    totalValidPixels += validIndices.length;
    totalExcludedPixels += excludedCount;
    totalGeometricPixels += totalCount;
    regionPixelLists[def.key] = validIndices;

    if (validIndices.length >= 80) {
      const LVals = validIndices.map((i) => lab.L[i]);
      const aVals = validIndices.map((i) => lab.a[i]);
      const bVals = validIndices.map((i) => lab.b[i]);
      const cVals = validIndices.map((i) => Math.hypot(lab.a[i], lab.b[i]));

      const { median: medianL, iqr: lightnessSpreadIQR } = computeRobustQuantiles(LVals);
      const { median: medianA } = computeRobustQuantiles(aVals);
      const { median: medianB } = computeRobustQuantiles(bVals);
      const { iqr: chromaSpreadIQR } = computeRobustQuantiles(cVals);

      regionalMetrics[def.key] = {
        medianL,
        medianA,
        medianB,
        lightnessSpreadIQR,
        chromaSpreadIQR,
        pixelCount: validIndices.length,
      };
    }
  }

  const measuredCount = Object.keys(regionalMetrics).length;
  const analyzedFraction = totalGeometricPixels > 0 ? totalValidPixels / totalGeometricPixels : 0;
  const excludedDueToQualityFraction =
    totalGeometricPixels > 0 ? totalExcludedPixels / totalGeometricPixels : 0;

  // Gating: Need at least 3 distinct regions with adequate skin coverage
  if (measuredCount < 3 || totalValidPixels < 500) {
    return {
      status: 'insufficient_quality',
      experimental: true,
      methodologyVersion: UNIFORMITY_METHODOLOGY_VERSION,
      skinTone: null,
      uniformityScore: null,
      band: null,
      regionalMetrics,
      colorDifferences: {
        leftRightDeltaE: null,
        meanInterRegionDeltaE: null,
        lightingAsymmetry: null,
      },
      quality: {
        validSkinPixelCount: totalValidPixels,
        analyzedFraction: Math.round(analyzedFraction * 1000) / 1000,
        excludedDueToQualityFraction: Math.round(excludedDueToQualityFraction * 1000) / 1000,
      },
      heatmap: null,
      warnings: ['insufficient_usable_skin_area'],
      explanation: text.skinToneUniformity.insufficientQuality,
      limitations: text.skinToneUniformity.limitations,
    };
  }

  const warnings: string[] = [];

  // 1. Cheek symmetry and lighting asymmetry analysis
  let leftRightDeltaE: number | null = null;
  let lightingAsymmetry: number | null = null;
  const cheekL = regionalMetrics.cheekLeft;
  const cheekR = regionalMetrics.cheekRight;

  if (cheekL && cheekR) {
    leftRightDeltaE = Math.round(
      deltaE76(cheekL.medianL, cheekL.medianA, cheekL.medianB, cheekR.medianL, cheekR.medianA, cheekR.medianB) * 100,
    ) / 100;
    lightingAsymmetry = Math.round(Math.abs(cheekL.medianL - cheekR.medianL) * 100) / 100;

    if (lightingAsymmetry > 14) {
      warnings.push('directional_lighting_detected');
    }
  }

  // 2. Baseline facial color (median of cheeks, or average of available regions)
  let baseL: number;
  let baseA: number;
  let baseB: number;

  if (cheekL && cheekR) {
    baseL = (cheekL.medianL + cheekR.medianL) / 2;
    baseA = (cheekL.medianA + cheekR.medianA) / 2;
    baseB = (cheekL.medianB + cheekR.medianB) / 2;
  } else {
    const list = Object.values(regionalMetrics);
    baseL = list.reduce((s, m) => s + m.medianL, 0) / list.length;
    baseA = list.reduce((s, m) => s + m.medianA, 0) / list.length;
    baseB = list.reduce((s, m) => s + m.medianB, 0) / list.length;
  }

  // 3. Between-region color distance (Delta E)
  const deltaEValues: number[] = [];
  const withinRegionSpreads: number[] = [];

  for (const [key, metric] of Object.entries(regionalMetrics)) {
    // If directional lighting is active, attenuate L* penalty for between-region comparison
    let dE: number;
    if (lightingAsymmetry && lightingAsymmetry > 14 && (key === 'cheekLeft' || key === 'cheekRight')) {
      // Chroma delta + compensated lightness delta
      const chromaDelta = Math.hypot(metric.medianA - baseA, metric.medianB - baseB);
      const lightDelta = Math.abs(metric.medianL - baseL) * 0.4;
      dE = Math.hypot(chromaDelta, lightDelta);
    } else {
      dE = deltaE76(metric.medianL, metric.medianA, metric.medianB, baseL, baseA, baseB);
    }
    deltaEValues.push(dE);
    withinRegionSpreads.push(metric.lightnessSpreadIQR + 0.6 * metric.chromaSpreadIQR);
  }

  const meanInterRegionDeltaE =
    Math.round((deltaEValues.reduce((s, v) => s + v, 0) / deltaEValues.length) * 100) / 100;
  const meanWithinSpread =
    withinRegionSpreads.reduce((s, v) => s + v, 0) / withinRegionSpreads.length;

  // 4. Tone-fair mathematical uniformity score formulation (0-100)
  // Continuous exponential model:
  // Penalty = 0.55 * InterRegionDeltaE + 0.45 * WithinRegionSpread
  // Normalizing scale denominator 7.5 guarantees monotonic scaling:
  // - Total discrepancy 0 -> 100
  // - Total discrepancy 2.0 -> 76 (High uniformity)
  // - Total discrepancy 4.5 -> 55 (Moderate uniformity)
  // - Total discrepancy 8.5 -> 32 (Variable)
  const totalDiscrepancy = 0.55 * meanInterRegionDeltaE + 0.45 * meanWithinSpread;
  const rawScore = 100 * Math.exp(-totalDiscrepancy / 7.5);
  const uniformityScore = Math.max(5, Math.min(100, Math.round(rawScore)));

  const band: 'high' | 'moderate' | 'variable' =
    uniformityScore >= 70 ? 'high' : uniformityScore >= 45 ? 'moderate' : 'variable';

  // 5. Enhance regional metrics with regional ITA, hex swatch, delta E, and clinical status
  for (const [key, metric] of Object.entries(regionalMetrics)) {
    if (!metric) continue;
    const indices = regionPixelLists[key] ?? [];
    metric.ita = computeITA(metric.medianL, metric.medianB);

    if (face.rgb && indices.length > 0) {
      const rVals = indices.map((i) => face.rgb[i * 3]);
      const gVals = indices.map((i) => face.rgb[i * 3 + 1]);
      const bVals = indices.map((i) => face.rgb[i * 3 + 2]);
      metric.hexColor = rgbToHex(
        computeRobustQuantiles(rVals).median,
        computeRobustQuantiles(gVals).median,
        computeRobustQuantiles(bVals).median,
      );
    } else {
      const [r, g, b] = labToRgb(metric.medianL, metric.medianA, metric.medianB);
      metric.hexColor = rgbToHex(r, g, b);
    }

    const dEFromBase = Math.round(deltaE76(metric.medianL, metric.medianA, metric.medianB, baseL, baseA, baseB) * 100) / 100;
    metric.deltaEFromBaseline = dEFromBase;

    const isAr = ctx.locale === 'ar';
    if (dEFromBase <= 2.0) {
      metric.statusLabel = isAr ? 'متجانس مع الدرجة الأساسية' : 'Even with Baseline';
    } else if (metric.medianL < baseL - 2.5) {
      metric.statusLabel = isAr ? 'أغمق قليلًا' : 'Slightly Darker';
    } else if (metric.medianA > baseA + 2.5) {
      metric.statusLabel = isAr ? 'مائل للاحمرار' : 'Slightly Flushed';
    } else if (metric.medianL > baseL + 2.5) {
      metric.statusLabel = isAr ? 'أفتح قليلًا' : 'Slightly Lighter';
    } else {
      metric.statusLabel = isAr ? 'متناسق' : 'Balanced';
    }
  }

  // 6. Sony Research Skin-Tone Extraction (Overall Facial Profile)
  const allValidIndices: number[] = [];
  for (const indices of Object.values(regionPixelLists)) {
    allValidIndices.push(...indices);
  }

  let overallHex: string;
  if (face.rgb && allValidIndices.length > 0) {
    const rVals = allValidIndices.map((i) => face.rgb[i * 3]);
    const gVals = allValidIndices.map((i) => face.rgb[i * 3 + 1]);
    const bVals = allValidIndices.map((i) => face.rgb[i * 3 + 2]);
    overallHex = rgbToHex(
      computeRobustQuantiles(rVals).median,
      computeRobustQuantiles(gVals).median,
      computeRobustQuantiles(bVals).median,
    );
  } else {
    const [r, g, b] = labToRgb(baseL, baseA, baseB);
    overallHex = rgbToHex(r, g, b);
  }

  const overallIta = computeITA(baseL, baseB);
  const fitz = determineFitzpatrick(overallIta, ctx.locale);
  const monk = matchMonkScale(baseL, baseA, baseB, ctx.locale);
  const under = determineUndertone(baseA, baseB, ctx.locale);

  const skinTone: DetectedSkinTone = {
    ita: overallIta,
    fitzpatrick: fitz.type,
    fitzpatrickLabel: fitz.fitzpatrickLabel,
    toneLabel: fitz.toneLabel,
    monk,
    undertone: under.undertone,
    undertoneLabel: under.undertoneLabel,
    hexColor: overallHex,
    lab: {
      L: Math.round(baseL * 10) / 10,
      a: Math.round(baseA * 10) / 10,
      b: Math.round(baseB * 10) / 10,
    },
    hueAngle: under.hueAngle,
  };

  // 7. Generate spatial Delta E deviation heatmap across valid skin
  const heatValues = new Float32Array(w * h);
  for (const indices of Object.values(regionPixelLists)) {
    for (const i of indices) {
      const dE = deltaE76(lab.L[i], lab.a[i], lab.b[i], baseL, baseA, baseB);
      // Map Delta E range [0..14] to [0..1]
      heatValues[i] = Math.min(1.0, Math.max(0, dE / 14));
    }
  }

  let heatmapUri: string | null = null;
  try {
    heatmapUri = await renderHeatmap(face, image, heatValues, PALETTES.pigmentation);
  } catch {
    heatmapUri = null;
  }

  return {
    status: 'ok',
    experimental: true,
    methodologyVersion: UNIFORMITY_METHODOLOGY_VERSION,
    skinTone,
    uniformityScore,
    band,
    regionalMetrics,
    colorDifferences: {
      leftRightDeltaE,
      meanInterRegionDeltaE,
      lightingAsymmetry,
    },
    quality: {
      validSkinPixelCount: totalValidPixels,
      analyzedFraction: Math.round(analyzedFraction * 1000) / 1000,
      excludedDueToQualityFraction: Math.round(excludedDueToQualityFraction * 1000) / 1000,
    },
    heatmap: heatmapUri,
    warnings,
    explanation: text.skinToneUniformity.summary(uniformityScore, band, skinTone),
    limitations: text.skinToneUniformity.limitations,
  };
}

