import type { AlignedFace } from './alignment';
import { confidenceLabel, MIN_REPORTABLE } from './confidence';
import { ramp } from './image/stats';
import { mm2, topFractionMean, type MetricMeasurement } from './metrics/common';
import type { Spot } from './metrics/blemishes';
import type { AnatomicalFacialRegionsV3 } from './regions-v3';
import { assessRegionQuality } from './quality-v3';
import { band, calibrate, CALIBRATION } from './scoring';
import type { SkinMasks } from './skin-mask';
import {
  ANATOMICAL_REGION_KEYS_V3,
  FEATURE_KEYS_V3,
  type FeatureKeyV3,
  type FeatureSummaryV3,
  type RegionFeatureResultV3,
  type RegionKeyV3,
  type RegionReportV3,
  type RegionUnavailableReason,
} from './types-v3';
import type { MetricKey, MetricResult } from './types';

/**
 * Anatomical-zone results (27 zones).
 *
 * The zones are not measured separately: each characteristic is measured once
 * over the face by its metric module (exposure-normalised, with fold
 * suppression, noise correction and so on), and its per-pixel evidence is then
 * summarised inside each zone with the same statistic and calibration as the
 * headline score. A zone's confidence is the headline confidence (so
 * expression, lighting, exposure and resolution count the same way), reduced
 * for small or partly covered zones, and no zone is scored when the headline
 * score was withheld. Zone scores are provisional, like the headline scores.
 */

export interface AggregateV3Output {
  regionsV3: Record<RegionKeyV3, RegionReportV3>;
  featureSummaries: Record<FeatureKeyV3, FeatureSummaryV3>;
}

const FOREHEAD: RegionKeyV3[] = ['foreheadCenter', 'foreheadLeft', 'foreheadRight', 'glabella', 'templeLeft', 'templeRight'];
const NOSE: RegionKeyV3[] = ['noseBridge', 'noseTip', 'nasalSidewallLeft', 'nasalSidewallRight', 'alarSkinLeft', 'alarSkinRight'];
const CHEEKS: RegionKeyV3[] = ['cheekLeft', 'cheekRight'];
const CHIN: RegionKeyV3[] = ['chinCenter', 'chinLeft', 'chinRight'];

/** Zones each characteristic is measured in (the regions of each metric module). */
const SUPPORTED: Record<FeatureKeyV3, ReadonlySet<RegionKeyV3>> = {
  pigmentation: new Set([...FOREHEAD, ...CHEEKS, ...CHIN]),
  redness: new Set([...FOREHEAD, ...NOSE, ...CHEEKS, ...CHIN]),
  texture: new Set([...FOREHEAD, ...NOSE, ...CHEEKS, ...CHIN]),
  blemishes: new Set([...FOREHEAD, ...NOSE, ...CHEEKS, ...CHIN]),
  shine: new Set([...FOREHEAD, ...NOSE, ...CHEEKS]),
  underEye: new Set(['underEyeLeft', 'underEyeRight']),
};

/** Statistic of the per-pixel map inside a zone: the same one the headline metric uses over the face. */
const TOP_FRACTION: Partial<Record<FeatureKeyV3, number>> = { pigmentation: 0.15, redness: 0.2 };

/** Smallest analysed area that gets its own zone score. */
const MIN_ZONE_MM2 = 20;

function withheld(
  feature: FeatureKeyV3,
  status: RegionFeatureResultV3['status'],
  reason?: RegionUnavailableReason,
): RegionFeatureResultV3 {
  return {
    feature,
    status,
    raw: null,
    score: null,
    band: null,
    confidence: null,
    confidenceLabel: null,
    calibrationStatus: 'provisional',
    warnings: [],
    ...(reason ? { unavailableReason: reason } : {}),
  };
}

/**
 * Raw value of a characteristic inside one zone, in the metric's own unit (see scoring.ts).
 * `overlap` lists the pixel indices of the zone that the metric analysed.
 */
function zoneRaw(
  feature: FeatureKeyV3,
  m: MetricMeasurement,
  overlap: Int32Array,
  face: AlignedFace,
  masks: SkinMasks,
  spots: Spot[],
): number | null {
  if (feature === 'underEye') {
    // A comparison per side: the side this zone lies on.
    let best: number | null = null;
    let bestOverlap = 0;
    for (const side of ['underEyeL', 'underEyeR'] as const) {
      const v = m.regionRaw[side];
      if (v === undefined) continue;
      const sideMask = masks.regions[side];
      let n = 0;
      for (const i of overlap) if (sideMask[i]) n++;
      if (n > bestOverlap) {
        bestOverlap = n;
        best = v;
      }
    }
    return best;
  }
  if (feature === 'blemishes') {
    // Contrast-weighted spots per 10 cm², as for the whole face.
    const inZone = new Set(overlap);
    let weighted = 0;
    for (const s of spots) if (inZone.has(s.y * face.width + s.x)) weighted += Math.min(1, s.strength / 2);
    return weighted / (mm2(overlap.length, face.pxPerMm) / 1000);
  }
  if (!m.map) return null;
  const values = new Float32Array(overlap.length);
  for (let k = 0; k < overlap.length; k++) values[k] = m.map[overlap[k]];
  const top = TOP_FRACTION[feature];
  if (top) return topFractionMean(values, top);
  // Texture and shine maps are already local averages (noise-corrected contrast, highlight share).
  let s = 0;
  for (let k = 0; k < values.length; k++) s += values[k];
  return values.length ? s / values.length : null;
}

/** Pixel indices of a mask, in row-major order. */
function indicesOf(mask: Uint8Array): Int32Array {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) n++;
  const out = new Int32Array(n);
  n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) out[n++] = i;
  return out;
}

/**
 * Builds the 27 zone reports and a summary per characteristic, after the
 * core metrics and their confidences are known.
 */
export function aggregateV3Analysis(
  face: AlignedFace,
  anatomical: AnatomicalFacialRegionsV3,
  masks: SkinMasks,
  measurements: MetricMeasurement[],
  analysis: Record<MetricKey, MetricResult>,
  spots: Spot[],
): AggregateV3Output {
  const p = face.pxPerMm;
  const regionsV3 = {} as Record<RegionKeyV3, RegionReportV3>;
  const scored: Record<FeatureKeyV3, { key: RegionKeyV3; score: number }[]> = Object.fromEntries(
    FEATURE_KEYS_V3.map((f) => [f, []]),
  ) as unknown as Record<FeatureKeyV3, { key: RegionKeyV3; score: number }[]>;

  for (const key of ANATOMICAL_REGION_KEYS_V3) {
    const region = anatomical.regions[key];
    const regionPixels = indicesOf(region.mask);
    const features: RegionReportV3['features'] = {};

    for (const feature of FEATURE_KEYS_V3) {
      if (!SUPPORTED[feature].has(key)) {
        features[feature] = withheld(feature, 'not_supported');
        continue;
      }
      const m = measurements.find((x) => x.key === feature);
      const headline = analysis[feature];
      if (!m || !m.scope || m.raw === null || headline.score === null) {
        features[feature] = withheld(feature, 'unavailable', 'insufficient_confidence');
        continue;
      }
      const scope = m.scope;
      const overlap = regionPixels.filter((i) => scope[i] === 1);
      const overlapPx = overlap.length;
      if (mm2(overlapPx, p) < MIN_ZONE_MM2) {
        features[feature] = withheld(feature, 'unavailable', region.unavailableReasons[0] ?? 'not_visible');
        continue;
      }
      const raw = zoneRaw(feature, m, overlap, face, masks, spots);
      if (raw === null || !Number.isFinite(raw)) {
        features[feature] = withheld(feature, 'unavailable', 'not_visible');
        continue;
      }
      // Smaller zones give noisier statistics; partly covered ones are less representative.
      const share = region.pixelCount ? overlapPx / region.pixelCount : 0;
      const confidence =
        headline.confidence * (0.7 + 0.3 * ramp(MIN_ZONE_MM2, 150, mm2(overlapPx, p))) * (0.7 + 0.3 * ramp(0.3, 0.8, share));
      if (confidence < MIN_REPORTABLE) {
        features[feature] = withheld(feature, 'unavailable', 'insufficient_confidence');
        continue;
      }
      const score = calibrate(feature, raw);
      features[feature] = {
        feature,
        status: 'measured',
        raw: Math.round(raw * 100) / 100,
        score,
        band: band(score),
        confidence: Math.round(confidence * 100) / 100,
        confidenceLabel: confidenceLabel(confidence),
        unit: CALIBRATION[feature].unit,
        calibrationStatus: 'provisional',
        warnings: [],
      };
      scored[feature].push({ key, score });
    }

    regionsV3[key] = {
      key,
      nameEn: region.nameEn,
      nameAr: region.nameAr,
      status: region.status,
      pixelCount: region.pixelCount,
      usableSkinPixels: region.usableSkinPixels,
      skinCoverage: region.skinCoverage,
      areaMm2: region.areaMm2,
      quality: assessRegionQuality(region, face, regionPixels),
      features,
      outline: region.outlineSource,
      outlineSource: region.outlineSource,
      unavailableReasons: region.unavailableReasons,
    };
  }

  // The summary per characteristic is the headline result; the zones say where it was seen.
  const featureSummaries = {} as Record<FeatureKeyV3, FeatureSummaryV3>;
  for (const feature of FEATURE_KEYS_V3) {
    const headline = analysis[feature];
    const zones = scored[feature].sort((a, b) => b.score - a.score);
    featureSummaries[feature] = {
      feature,
      status: headline.score === null ? 'unavailable' : 'measured',
      overallScore: headline.score,
      overallBand: headline.band,
      overallConfidence: headline.confidence,
      overallConfidenceLabel: headline.confidenceLabel,
      prominentRegions: zones.filter((z) => z.score >= 25).slice(0, 2).map((z) => z.key),
      measuredRegionCount: zones.length,
      totalRegionCount: SUPPORTED[feature].size,
    };
  }

  return { regionsV3, featureSummaries };
}
