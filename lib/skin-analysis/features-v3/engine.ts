import type { AlignedFace } from '../alignment';
import { confidenceLabel } from '../confidence';
import { band, calibrate } from '../scoring';
import { countPixels, mm2 } from '../metrics/common';
import { checkFeatureFeasibility } from '../quality-v3';
import type {
  FeatureKeyV3,
  RegionFeatureResultV3,
  RegionQualityV3,
  RegionUnavailableReason,
} from '../types-v3';
import type { AnatomicalRegionV3 } from '../regions-v3';
import { detectBlobs } from '../metrics/blobs';
import { gaussianBlur } from '../image/filters';
import { quantiles, robustSpread } from '../image/stats';

export interface RegionalMeasurementContext {
  face: AlignedFace;
  allRegions: Record<string, AnatomicalRegionV3>;
  illumination: number;
  baselineRednessRatio: number;
  cache: Map<string, Float32Array>;
  faceSpots?: { x: number; y: number; sigma: number; strength: number }[];
  facePores?: { x: number; y: number; sigma: number; strength: number }[];
}

function getCachedBlur(ctx: RegionalMeasurementContext, key: string, src: Float32Array, sigma: number): Float32Array {
  const k = `${key}@${sigma.toFixed(2)}`;
  let b = ctx.cache.get(k);
  if (!b) {
    b = gaussianBlur(src, ctx.face.width, ctx.face.height, sigma);
    ctx.cache.set(k, b);
  }
  return b;
}

const PORE_BEARING_REGIONS = new Set([
  'foreheadCenter',
  'foreheadLeft',
  'foreheadRight',
  'noseBridge',
  'noseTip',
  'nasalSidewallLeft',
  'nasalSidewallRight',
  'alarSkinLeft',
  'alarSkinRight',
  'cheekLeft',
  'cheekRight',
  'chinCenter',
  'chinLeft',
  'chinRight',
]);

/**
 * Calculates a specific skin feature within an individual anatomical region mask.
 * Guarantees that:
 * 1. Missing/occluded/low-quality regions return an explicit unavailable state.
 * 2. Unreliable measurements are never silently replaced with 0.
 * 3. Confidence reflects local region quality, coverage, and signal-to-noise ratio.
 */
export function measureRegionFeature(
  feature: FeatureKeyV3,
  region: AnatomicalRegionV3,
  quality: RegionQualityV3,
  ctx: RegionalMeasurementContext,
): RegionFeatureResultV3 {
  const { face, illumination, baselineRednessRatio } = ctx;
  const p = face.pxPerMm;

  // 1. Feasibility check
  const infeasibleReason = checkFeatureFeasibility(feature, region.key, quality, p);
  if (infeasibleReason) {
    return {
      feature,
      status: infeasibleReason === 'low_resolution' || infeasibleReason === 'blurry' ? 'low_quality' : 'unavailable',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'provisional',
      warnings: [`Feature ${feature} unavailable in ${region.nameEn}: ${infeasibleReason}`],
      unavailableReason: infeasibleReason,
    };
  }

  const mask = region.mask;
  const pixelCount = countPixels(mask);
  if (pixelCount < 60) {
    return {
      feature,
      status: 'unavailable',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'provisional',
      warnings: ['Insufficient region area'],
      unavailableReason: 'insufficient_skin',
    };
  }

  // 2. Feature-specific measurement
  try {
    switch (feature) {
      case 'pigmentation':
        return measureRegionalPigmentation(face, mask, quality, ctx);

      case 'redness':
        return measureRegionalRedness(face, mask, quality, baselineRednessRatio, ctx);

      case 'texture':
        return measureRegionalTexture(face, mask, quality, ctx);

      case 'blemishes':
        return measureRegionalBlemishes(face, mask, quality, region.key, ctx);

      case 'shine':
        return measureRegionalShine(face, mask, quality, illumination, ctx);

      case 'underEye':
        return measureRegionalUnderEye(face, region, quality, ctx);

      case 'pores':
        return measureRegionalPores(face, mask, quality, region.key, ctx);

      default:
        return {
          feature,
          status: 'not_supported',
          raw: null,
          score: null,
          band: null,
          confidence: null,
          confidenceLabel: null,
          calibrationStatus: 'experimental',
          warnings: ['Unsupported feature key'],
        };
    }
  } catch (err) {
    return {
      feature,
      status: 'processing_error',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'experimental',
      warnings: [err instanceof Error ? err.message : String(err)],
    };
  }
}

// ---------------------------------------------------------------------------
// A. Regional Pigmentation
// ---------------------------------------------------------------------------
function measureRegionalPigmentation(
  face: AlignedFace,
  mask: Uint8Array,
  quality: RegionQualityV3,
  ctx: RegionalMeasurementContext,
): RegionFeatureResultV3 {
  const { lab } = face;
  const p = face.pxPerMm;

  // Smooth local L* and compute relative darkening against reference
  const sNarrow = Math.max(0.8, 0.4 * p);
  const sBroad = Math.max(3.0, 5.0 * p);

  const LNarrow = getCachedBlur(ctx, 'L_narrow', lab.L, sNarrow);
  const LBroad = getCachedBlur(ctx, 'L_broad', lab.L, sBroad);

  const deltas: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    // Local pigment-equivalent darkening ΔL*
    const d = Math.max(0, LBroad[i] - LNarrow[i]);
    deltas.push(d);
  }

  if (deltas.length < 50) {
    return {
      feature: 'pigmentation',
      status: 'unavailable',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'provisional',
      warnings: ['Insufficient valid pixels'],
      unavailableReason: 'insufficient_skin',
    };
  }

  // Focus on the most affected 15% of pixels in this region
  deltas.sort((a, b) => b - a);
  const top15Count = Math.max(1, Math.round(deltas.length * 0.15));
  let sum = 0;
  for (let i = 0; i < top15Count; i++) sum += deltas[i];
  const raw = Math.round((sum / top15Count) * 100) / 100;

  const score = calibrate('pigmentation', raw);
  const scoreBand = band(score);
  const confidence = Math.min(0.9, Math.max(0.3, quality.usableCoverage * (1 - quality.clippedFraction * 0.5) * (0.5 + 0.5 * quality.sharpness)));

  return {
    feature: 'pigmentation',
    status: 'measured',
    raw,
    score,
    band: scoreBand,
    confidence: Math.round(confidence * 100) / 100,
    confidenceLabel: confidenceLabel(confidence),
    unit: 'ΔL* (top 15% darkening)',
    calibrationStatus: 'calibrated',
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// B. Regional Redness
// ---------------------------------------------------------------------------
function measureRegionalRedness(
  face: AlignedFace,
  mask: Uint8Array,
  quality: RegionQualityV3,
  baselineRednessRatio: number,
  ctx: RegionalMeasurementContext,
): RegionFeatureResultV3 {
  const { lab } = face;
  const p = face.pxPerMm;

  const aSmooth = getCachedBlur(ctx, 'a_smooth', lab.a, Math.max(0.8, 0.4 * p));

  const excesses: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const aExpected = baselineRednessRatio * (lab.L[i] + 16);
    const excess = Math.max(0, aSmooth[i] - aExpected);
    excesses.push(excess);
  }

  if (excesses.length < 50) {
    return {
      feature: 'redness',
      status: 'unavailable',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'provisional',
      warnings: ['Insufficient valid pixels'],
      unavailableReason: 'insufficient_skin',
    };
  }

  excesses.sort((a, b) => b - a);
  const top20Count = Math.max(1, Math.round(excesses.length * 0.20));
  let sum = 0;
  for (let i = 0; i < top20Count; i++) sum += excesses[i];
  const raw = Math.round((sum / top20Count) * 100) / 100;

  const score = calibrate('redness', raw);
  const scoreBand = band(score);
  const confidence = Math.min(0.92, Math.max(0.3, quality.usableCoverage * (1 - quality.clippedFraction * 0.4)));

  return {
    feature: 'redness',
    status: 'measured',
    raw,
    score,
    band: scoreBand,
    confidence: Math.round(confidence * 100) / 100,
    confidenceLabel: confidenceLabel(confidence),
    unit: 'a* excess (top 20%)',
    calibrationStatus: 'calibrated',
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// C. Regional Texture
// ---------------------------------------------------------------------------
function measureRegionalTexture(
  face: AlignedFace,
  mask: Uint8Array,
  quality: RegionQualityV3,
  ctx: RegionalMeasurementContext,
): RegionFeatureResultV3 {
  const { lab } = face;
  const p = face.pxPerMm;

  if (p < 2.0) {
    return {
      feature: 'texture',
      status: 'low_quality',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'provisional',
      warnings: ['Insufficient pixel density for texture resolution'],
      unavailableReason: 'low_resolution',
    };
  }

  // 0.2–1.0 mm difference-of-Gaussians on log Y
  const sFine = Math.max(0.5, 0.2 * p);
  const sCoarse = Math.max(1.2, 1.0 * p);

  const fine = getCachedBlur(ctx, 'logY_fine', lab.logY, sFine);
  const coarse = getCachedBlur(ctx, 'logY_coarse', lab.logY, sCoarse);

  const diffs: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    diffs.push(Math.abs(fine[i] - coarse[i]));
  }

  if (diffs.length < 50) {
    return {
      feature: 'texture',
      status: 'unavailable',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'provisional',
      warnings: ['Insufficient valid pixels'],
      unavailableReason: 'insufficient_skin',
    };
  }

  // Robust IQR spread
  const arr = Float32Array.from(diffs);
  const spread = robustSpread(arr);
  const raw = Math.round(spread.sigma * 100 * 100) / 100; // in percent

  const score = calibrate('texture', raw);
  const scoreBand = band(score);
  const confidence = Math.min(0.88, Math.max(0.25, quality.sharpness * quality.usableCoverage * (quality.snr > 15 ? 1 : 0.6)));

  return {
    feature: 'texture',
    status: 'measured',
    raw,
    score,
    band: scoreBand,
    confidence: Math.round(confidence * 100) / 100,
    confidenceLabel: confidenceLabel(confidence),
    unit: 'DoG contrast (%)',
    calibrationStatus: 'calibrated',
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// D. Regional Blemishes
// ---------------------------------------------------------------------------
function measureRegionalBlemishes(
  face: AlignedFace,
  mask: Uint8Array,
  quality: RegionQualityV3,
  _regionKey: string,
  ctx: RegionalMeasurementContext,
): RegionFeatureResultV3 {
  const { width: w, height: h, lab } = face;
  const p = face.pxPerMm;

  const area = mm2(countPixels(mask), p);
  if (area < 100) {
    return {
      feature: 'blemishes',
      status: 'unavailable',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'provisional',
      warnings: ['Region skin area too small for spot counting'],
      unavailableReason: 'insufficient_skin',
    };
  }

  // Multi-scale candidate detection (1.5–5 mm spots) - cached face-wide
  if (!ctx.faceSpots) {
    const sigmas = [0.6 * p, 1.0 * p, 1.5 * p];
    const responses = (s: number) => {
      const Li = getCachedBlur(ctx, `L@${s.toFixed(2)}`, lab.L, s);
      const Lo = getCachedBlur(ctx, `L@${(s * 1.6).toFixed(2)}`, lab.L, s * 1.6);
      const Ai = getCachedBlur(ctx, `a@${s.toFixed(2)}`, lab.a, s);
      const Ao = getCachedBlur(ctx, `a@${(s * 1.6).toFixed(2)}`, lab.a, s * 1.6);
      const r = new Float32Array(Li.length);
      for (let i = 0; i < r.length; i++) {
        const dark = (Lo[i] - Li[i]) / 2.0;
        const red = (Ai[i] - Ao[i]) / 1.5;
        r[i] = Math.max(dark, red);
      }
      return r;
    };
    ctx.faceSpots = detectBlobs(responses, sigmas, () => 1, face.valid, w, h, 0.85);
  }

  let weightedSpots = 0;
  let spotCount = 0;
  for (const b of ctx.faceSpots) {
    const idx = b.y * w + b.x;
    if (mask[idx]) {
      weightedSpots += b.strength;
      spotCount++;
    }
  }

  // Spots per 10 cm² (1000 mm²)
  const density = (weightedSpots / area) * 1000;
  const raw = Math.round(density * 100) / 100;

  const score = calibrate('blemishes', raw);
  const scoreBand = band(score);
  const confidence = Math.min(0.85, Math.max(0.3, quality.usableCoverage * quality.sharpness));

  return {
    feature: 'blemishes',
    status: 'measured',
    raw,
    score,
    band: scoreBand,
    confidence: Math.round(confidence * 100) / 100,
    confidenceLabel: confidenceLabel(confidence),
    unit: 'spots / 10 cm²',
    calibrationStatus: 'calibrated',
    warnings: [],
    details: { spotCount, areaMm2: Math.round(area) },
  };
}

// ---------------------------------------------------------------------------
// E. Regional Shine
// ---------------------------------------------------------------------------
function measureRegionalShine(
  face: AlignedFace,
  mask: Uint8Array,
  quality: RegionQualityV3,
  illumination: number,
  ctx: RegionalMeasurementContext,
): RegionFeatureResultV3 {
  const { lab, rgb } = face;
  const p = face.pxPerMm;

  // Diffuse baseline
  const diffuseBlur = getCachedBlur(ctx, 'Y_diffuse', lab.Y, Math.max(2, 4 * p));
  let highlightCount = 0;
  let totalCount = 0;

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    totalCount++;
    const isClipped = rgb[i * 3] >= 250 && rgb[i * 3 + 1] >= 250;
    const isHighlight = lab.Y[i] > diffuseBlur[i] + 0.12 * illumination;
    if (isClipped || isHighlight) highlightCount++;
  }

  if (totalCount < 50) {
    return {
      feature: 'shine',
      status: 'unavailable',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'provisional',
      warnings: ['Insufficient valid pixels'],
      unavailableReason: 'insufficient_skin',
    };
  }

  const raw = Math.round((highlightCount / totalCount) * 1000) / 10; // in %

  const score = calibrate('shine', raw);
  const scoreBand = band(score);
  // Capped at 0.62 because shine depends on angle to light source
  const confidence = Math.min(0.62, Math.max(0.25, quality.usableCoverage * (1 - quality.clippedFraction * 0.5)));

  return {
    feature: 'shine',
    status: 'measured',
    raw,
    score,
    band: scoreBand,
    confidence: Math.round(confidence * 100) / 100,
    confidenceLabel: confidenceLabel(confidence),
    unit: '% highlight skin area',
    calibrationStatus: 'calibrated',
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// F. Regional Under-Eye
// ---------------------------------------------------------------------------
function measureRegionalUnderEye(
  face: AlignedFace,
  region: AnatomicalRegionV3,
  quality: RegionQualityV3,
  ctx: RegionalMeasurementContext,
): RegionFeatureResultV3 {
  if (region.key !== 'underEyeLeft' && region.key !== 'underEyeRight') {
    return {
      feature: 'underEye',
      status: 'not_supported',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'experimental',
      warnings: ['Under-eye metric only applies to underEye regions'],
    };
  }

  const cheekKey = region.key === 'underEyeLeft' ? 'cheekLeft' : 'cheekRight';
  const cheekRegion = ctx.allRegions[cheekKey];

  if (!cheekRegion || cheekRegion.status === 'unavailable') {
    return {
      feature: 'underEye',
      status: 'unavailable',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'provisional',
      warnings: ['Cheek reference region unavailable'],
      unavailableReason: 'insufficient_skin',
    };
  }

  const { lab } = face;

  const underEyeLValues: number[] = [];
  for (let i = 0; i < region.mask.length; i++) {
    if (region.mask[i]) underEyeLValues.push(lab.L[i]);
  }

  const cheekLValues: number[] = [];
  for (let i = 0; i < cheekRegion.mask.length; i++) {
    if (cheekRegion.mask[i]) cheekLValues.push(lab.L[i]);
  }

  if (underEyeLValues.length < 30 || cheekLValues.length < 50) {
    return {
      feature: 'underEye',
      status: 'unavailable',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'provisional',
      warnings: ['Insufficient under-eye or cheek sample size'],
      unavailableReason: 'insufficient_skin',
    };
  }

  const medianUnderEyeL = quantiles(Float32Array.from(underEyeLValues), [0.5])[0];
  const medianCheekL = quantiles(Float32Array.from(cheekLValues), [0.5])[0];

  const deltaL = Math.max(0, medianCheekL - medianUnderEyeL);
  const raw = Math.round(deltaL * 100) / 100;

  const score = calibrate('underEye', raw);
  const scoreBand = band(score);
  // Overhead light creates shadows, so under-eye confidence is capped at 0.65
  const confidence = Math.min(0.65, Math.max(0.2, quality.usableCoverage * 0.7));

  return {
    feature: 'underEye',
    status: 'measured',
    raw,
    score,
    band: scoreBand,
    confidence: Math.round(confidence * 100) / 100,
    confidenceLabel: confidenceLabel(confidence),
    unit: 'ΔL* (cheek − under-eye)',
    calibrationStatus: 'calibrated',
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// G. Regional Pores (Experimental)
// ---------------------------------------------------------------------------
function measureRegionalPores(
  face: AlignedFace,
  mask: Uint8Array,
  quality: RegionQualityV3,
  regionKey: string,
  ctx: RegionalMeasurementContext,
): RegionFeatureResultV3 {
  if (!PORE_BEARING_REGIONS.has(regionKey)) {
    return {
      feature: 'pores',
      status: 'unavailable',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'experimental',
      warnings: ['Region is not an anatomical pore-bearing region'],
      unavailableReason: 'not_visible',
    };
  }

  const { width: w, height: h, lab } = face;
  const p = face.pxPerMm;

  if (p < 4.5 || quality.sharpness < 0.28) {
    return {
      feature: 'pores',
      status: 'low_quality',
      raw: null,
      score: null,
      band: null,
      confidence: null,
      confidenceLabel: null,
      calibrationStatus: 'experimental',
      warnings: ['Resolution or sharpness too low for pore analysis'],
      unavailableReason: p < 4.5 ? 'low_resolution' : 'blurry',
    };
  }

  // Detect pore blobs across the face crop once, cache in ctx
  if (!ctx.facePores) {
    const sigmas = [0.08 * p, 0.12 * p, 0.17 * p];
    const responses = (s: number) => {
      const Li = getCachedBlur(ctx, `logY@${s.toFixed(2)}`, lab.logY, s);
      const Lo = getCachedBlur(ctx, `logY@${(s * 2.0).toFixed(2)}`, lab.logY, s * 2.0);
      const r = new Float32Array(Li.length);
      for (let i = 0; i < r.length; i++) r[i] = Math.max(0, Lo[i] - Li[i]);
      return r;
    };
    ctx.facePores = detectBlobs(responses, sigmas, () => 0.04, face.valid, w, h, 0.8);
  }

  let poreCount = 0;
  for (const b of ctx.facePores) {
    const idx = b.y * w + b.x;
    if (mask[idx]) {
      poreCount++;
    }
  }

  const area = mm2(countPixels(mask), p) / 100; // cm²
  const raw = area > 0 ? Math.round((poreCount / area) * 10) / 10 : 0;

  // Calibrate pore index (0 / 6 / 18 / 40 / 75)
  const score = Math.min(100, Math.round((raw / 75) * 100));
  const scoreBand = band(score);
  const confidence = Math.min(0.60, Math.max(0.2, quality.sharpness * 0.7));

  return {
    feature: 'pores',
    status: 'measured',
    raw,
    score,
    band: scoreBand,
    confidence: Math.round(confidence * 100) / 100,
    confidenceLabel: confidenceLabel(confidence),
    unit: 'pores / cm²',
    calibrationStatus: 'experimental',
    warnings: [],
  };
}
