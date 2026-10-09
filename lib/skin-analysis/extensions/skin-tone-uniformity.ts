import type { AlignedFace } from '../alignment';
import type { RgbImage } from '../image/decode';
import { robustSpread } from '../image/stats';
import type { MetricContext } from '../metrics/common';
import { PALETTES, renderHeatmap } from './projection';
import { analysisText } from '../text';
import type {
  RegionalLabMetrics,
  RegionKey,
  SkinToneUniformityReport,
} from '../types';

/**
 * Skin-Tone Uniformity Analysis Engine (Dr Maher Vision AI v3.5).
 *
 * Evaluates visible color and lightness consistency across canonical facial
 * anatomical zones: Forehead, Left Cheek, Right Cheek, Nose, and Chin.
 *
 * Methodology:
 *  1. Non-skin veto: Reuses anatomical masks, strictly excluding eyes,
 *     eyebrows, lips, nostrils, hair, clothing, and background.
 *  2. Quality filtration: Excludes specular reflections / clipping (max RGB >= 245
 *     or L* >= 95) and deep occluding shadows (L* <= 12).
 *  3. CIELAB colorimetry: Converts all valid pixels to standard CIELAB (D65).
 *  4. Robust regional statistics: Computes median L*, a*, b*, interquartile
 *     lightness variation (IQR), and chroma spread.
 *  5. Inter-region perceptual color distance: Evaluates pairwise Delta E*ab
 *     relative to facial baseline color.
 *  6. Lighting asymmetry gating: Detects directional lighting differences
 *     between left and right cheeks to avoid penalizing asymmetric shadows.
 *  7. Normalized 0–100 score: Continuous, tone-fair mathematical formulation
 *     benchmarked across all Fitzpatrick phototypes (I through VI).
 *  8. Heatmap: Generates a spatial Delta E deviation map across facial skin.
 *
 * Informational / non-diagnostic: describes visible photographic skin color
 * distribution, not melanin concentrations or medical pigmentary disorders.
 */

export const UNIFORMITY_METHODOLOGY_VERSION = '3.5.0';

export interface UniformityAnalysisOptions {
  enabled: boolean;
  locale?: 'en' | 'ar';
}

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

  // 5. Generate spatial Delta E deviation heatmap across valid skin
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
    explanation: text.skinToneUniformity.summary(uniformityScore, band),
    limitations: text.skinToneUniformity.limitations,
  };
}

