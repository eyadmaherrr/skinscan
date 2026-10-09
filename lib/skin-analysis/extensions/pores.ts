import { confidenceLabel, MIN_REPORTABLE } from '../confidence';
import { dogNoiseGain, estimateNoiseSigma, gaussianBlur } from '../image/filters';
import { ramp } from '../image/stats';
import { detectBlobs } from '../metrics/blobs';
import { countPixels, mm2, union, type MetricContext } from '../metrics/common';
import { analysisText, type AnalysisText } from '../text';
import type { PoreReport, RegionKey } from '../types';

/**
 * Pore-appearance analysis (experimental).
 *
 * Visible pores appear as small (≈0.15–0.4 mm), round spots slightly darker
 * than the skin around them. They are found as local maxima of a multi-scale
 * difference of Gaussians on log luminance (relative contrast, independent of
 * skin tone) — the high-pass + blob-detection idea also used by the MIT
 * licensed DurtyDhiana/skin-scan project — but with physical scale (px/mm from
 * the inter-ocular distance) and absolute, noise-adaptive thresholds instead
 * of per-photo normalisation, so a photo without visible pores scores low.
 *
 * Exclusions: eyes, brows, lips, hair and accessories (shared skin masks),
 * overexposed pixels, larger spots found by the blemish detector (acne,
 * marks, moles), and the lower cheeks / chin / jaw (stubble looks like pores).
 *
 * This is an appearance estimate of how *visible* pores are in this photo. It
 * does not measure pore size, sebum or any physiological property.
 */

const REGIONS: RegionKey[] = ['nose', 'forehead', 'cheekL', 'cheekR'];
/** Raw value (weighted visible pores per cm²) at scores 0/25/50/75/100. */
export const PORE_ANCHORS: [number, number, number, number, number] = [0, 6, 18, 40, 75];
/**
 * Task-specific gate. Evaluation on 5–5.5 px/mm portraits showed scores moving
 * by up to 15 points with mild camera noise, so pores are only estimated on
 * close (≥ 6 px/mm, i.e. a phone selfie at arm's length), sharp, low-noise photos.
 */
export const PORE_THRESHOLDS = {
  minPxPerMm: 6,
  maxBlurIndex: 0.45,
  minSnr: 60,
  minNaturalDetail: 0.8,
  minCoverage: 0.4,
} as const;


export interface PoreAnalysis {
  report: PoreReport;
  /** Visibility map (0–1) on the aligned crop, for the heatmap. */
  heat: Float32Array | null;
  raw: number | null;
  /** Why the estimate was not possible (task-specific quality problems). */
  reasons: string[];
}

function calibratePores(raw: number): number {
  const a = PORE_ANCHORS;
  if (raw <= a[0]) return 0;
  if (raw >= a[4]) return 100;
  for (let i = 0; i < 4; i++) if (raw <= a[i + 1]) return Math.round(25 * (i + (raw - a[i]) / (a[i + 1] - a[i])));
  return 100;
}

/** Keep only the upper part (fraction `keep`) of a region mask. */
function upperPart(mask: Uint8Array, w: number, h: number, keep: number): Uint8Array {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (top < 0) top = y;
      bottom = y;
      break;
    }
  }
  if (top < 0) return mask;
  const limit = top + (bottom - top) * keep;
  const out = mask.slice();
  for (let y = Math.ceil(limit); y < h; y++) out.fill(0, y * w, (y + 1) * w);
  return out;
}

function unavailable(text: AnalysisText, status: PoreReport['status'], explanation: string, extra: string[] = []): PoreAnalysis {
  return {
    report: {
      status,
      visibilityScore: null,
      scoreScale: text.pores.scale,
      confidence: null,
      confidenceLabel: null,
      regionalSummary: {},
      heatmap: null,
      explanation,
      limitations: [...extra, ...text.pores.limitations],
    },
    heat: null,
    raw: null,
    reasons: extra,
  };
}

export function analyzePores(ctx: MetricContext): PoreAnalysis {
  const { face, masks, quality } = ctx;
  const { width: w, height: h } = face;
  const p = face.pxPerMm;
  const T = PORE_THRESHOLDS;
  const d = quality.diagnostics;
  const text = analysisText(ctx.locale);

  // Task-specific quality gate: pores need far more detail than colour metrics.
  const reasons: string[] = [];
  if (p < T.minPxPerMm) reasons.push(text.pores.tooFar);
  if ((d.blurIndex ?? 1) > T.maxBlurIndex) reasons.push(text.pores.notSharp);
  if ((d.snr ?? 0) < T.minSnr) reasons.push(text.pores.grainy);
  if (quality.factors.naturalDetail < T.minNaturalDetail) reasons.push(text.pores.smoothed);

  const regionMasks: Partial<Record<RegionKey, Uint8Array>> = {
    nose: masks.regions.nose,
    forehead: masks.regions.forehead,
    cheekL: upperPart(masks.regions.cheekL, w, h, 0.6),
    cheekR: upperPart(masks.regions.cheekR, w, h, 0.6),
  };
  const coverage = REGIONS.reduce((s, k) => s + masks.coverage[k], 0) / REGIONS.length;
  if (coverage < T.minCoverage) reasons.push(text.pores.notEnoughArea);
  if (reasons.length) return unavailable(text, 'insufficient_quality', text.pores.unreliable, reasons);

  // Exclude larger spots (acne, marks, moles) found by the blemish detector.
  const mask = union(regionMasks as Record<RegionKey, Uint8Array>, REGIONS);
  for (const s of ctx.spots ?? []) {
    const r = Math.ceil(2.5 * s.sigma);
    for (let y = Math.max(0, s.y - r); y <= Math.min(h - 1, s.y + r); y++) {
      for (let x = Math.max(0, s.x - r); x <= Math.min(w - 1, s.x + r); x++) {
        if ((x - s.x) ** 2 + (y - s.y) ** 2 <= r * r) mask[y * w + x] = 0;
      }
    }
  }
  const area = countPixels(mask);
  if (area < 500) return unavailable(text, 'insufficient_quality', text.pores.notEnoughSkin);

  const logY = face.lab.logY;
  const noise = estimateNoiseSigma(logY, mask, w, h);
  const sigmas = [0.08 * p, 0.12 * p, 0.17 * p].map((s) => Math.max(0.7, s));
  const blurCache = new Map<number, Float32Array>();
  const blur = (s: number) => {
    let b = blurCache.get(s);
    if (!b) {
      b = gaussianBlur(logY, w, h, s);
      blurCache.set(s, b);
    }
    return b;
  };
  const responses = (s: number) => {
    const inner = blur(s);
    const outer = blur(s * 1.6);
    const r = new Float32Array(inner.length);
    for (let i = 0; i < r.length; i++) r[i] = outer[i] - inner[i]; // > 0 where the centre is darker
    return r;
  };
  // At least 4% darker than the surrounding skin and 5× the camera noise at that scale.
  const threshold = (s: number) => Math.max(0.04, 5 * noise * Math.sqrt(dogNoiseGain(s, s * 1.6)));
  const blobs = detectBlobs(responses, sigmas, threshold, mask, w, h, 0.9);

  const points = new Float32Array(w * h);
  let weighted = 0;
  const regionWeight: Partial<Record<RegionKey, number>> = {};
  for (const b of blobs) {
    const wgt = Math.min(1, b.strength / 2.5);
    weighted += wgt;
    points[b.y * w + b.x] += wgt;
    const i = b.y * w + b.x;
    const region = REGIONS.find((k) => regionMasks[k]?.[i]);
    if (region) regionWeight[region] = (regionWeight[region] ?? 0) + wgt;
  }
  const raw = weighted / (mm2(area, p) / 100);
  const regionalSummary: Partial<Record<RegionKey, number>> = {};
  for (const k of REGIONS) {
    const a = countPixels(regionMasks[k] as Uint8Array);
    if (a > 300 && masks.coverage[k] >= 0.3) regionalSummary[k] = calibratePores((regionWeight[k] ?? 0) / (mm2(a, p) / 100));
  }

  // Density map (pores per cm², smoothed over ≈1.5 mm) → 0–1 on the same scale as the score.
  const sigmaPx = 1.5 * p;
  const density = gaussianBlur(points, w, h, sigmaPx);
  const pxPerCm2 = 100 * p * p;
  const heat = new Float32Array(w * h);
  for (let i = 0; i < heat.length; i++) {
    if (!mask[i]) continue;
    heat[i] = calibratePores(density[i] * pxPerCm2) / 100;
  }

  // Confidence: experimental component, capped at moderate.
  const f = quality.factors;
  const confidence =
    0.62 *
    (0.8 + 0.2 * ramp(T.minPxPerMm, 6.6, p)) *
    (1 - 0.6 + 0.6 * f.sharpness) *
    (1 - 0.5 + 0.5 * f.noise) *
    (1 - 0.4 + 0.4 * f.naturalDetail) *
    (0.4 + 0.6 * ramp(0.4, 0.8, coverage));
  const rounded = Math.round(confidence * 100) / 100;
  if (confidence < MIN_REPORTABLE) {
    return unavailable(text, 'insufficient_quality', text.pores.conditions, [text.pores.conditionsHelp]);
  }
  const score = calibratePores(raw);
  const ranked = (Object.entries(regionalSummary) as [RegionKey, number][]).sort((a, b) => b[1] - a[1]);
  const top = ranked.length && ranked[0][1] >= 25 ? ranked[0][0] : null;
  const where = top === 'nose' ? text.pores.where.nose : top === 'forehead' ? text.pores.where.forehead : top ? text.pores.where.cheeks : null;
  return {
    report: {
      status: 'ok',
      visibilityScore: score,
      scoreScale: text.pores.scale,
      confidence: rounded,
      confidenceLabel: confidenceLabel(confidence),
      regionalSummary,
      heatmap: null,
      explanation: text.pores.summary(text.pores.level(score), where),
      limitations: text.pores.limitations,
    },
    heat,
    raw,
    reasons: [],
  };
}
