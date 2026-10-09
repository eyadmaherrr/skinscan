import type { AlignedFace } from './alignment';
import { confidenceLabel } from './confidence';
import { band, calibrate } from './scoring';
import { ANATOMICAL_REGION_KEYS_V3, type FeatureKeyV3, type FeatureStatusV3, type FeatureSummaryV3, type RegionKeyV3, type RegionReportV3 } from './types-v3';
import type { AnatomicalFacialRegionsV3 } from './regions-v3';
import { assessRegionQuality } from './quality-v3';
import { measureRegionFeature, type RegionalMeasurementContext } from './features-v3/engine';
import type { MetricKey, MetricResult } from './types';
import { quantiles } from './image/stats';
import type { QualityAssessment } from './quality';

export interface AggregateV3Output {
  regionsV3: Record<RegionKeyV3, RegionReportV3>;
  featureSummaries: Record<FeatureKeyV3, FeatureSummaryV3>;
  legacyAnalysis: Record<MetricKey, MetricResult>;
  overallConfidence: number;
}

/**
 * Executes region-by-region measurement across all 24 anatomical regions,
 * generates region quality assessments and feature results, and aggregates
 * them into both v3 feature summaries and legacy MetricResults.
 */
export function aggregateV3Analysis(
  face: AlignedFace,
  anatomicalRegions: AnatomicalFacialRegionsV3,
  quality: QualityAssessment,
  locale: 'en' | 'ar' = 'en',
): AggregateV3Output {
  const { regions } = anatomicalRegions;
  const { lab } = face;

  // Scene-wide reference anchors
  const scleraY = quality.diagnostics.scleraY;
  const illumination = Number.isFinite(scleraY) && scleraY > 0 ? scleraY : 0.6;

  // Compute face-wide 20th percentile of a* / (L* + 16) as shading-invariant redness baseline
  const aRatios: number[] = [];
  for (let i = 0; i < anatomicalRegions.usableSkin.length; i++) {
    if (anatomicalRegions.usableSkin[i]) {
      aRatios.push(lab.a[i] / (lab.L[i] + 16));
    }
  }
  const baselineRednessRatio = aRatios.length ? quantiles(Float32Array.from(aRatios), [0.2])[0] : 0.2;

  const ctx: RegionalMeasurementContext = {
    face,
    allRegions: regions,
    illumination,
    baselineRednessRatio,
    cache: new Map(),
  };

  const regionsV3 = {} as Record<RegionKeyV3, RegionReportV3>;
  const featuresToRun: FeatureKeyV3[] = [
    'pigmentation',
    'redness',
    'texture',
    'blemishes',
    'shine',
    'underEye',
    'pores',
  ];

  // 1. Process each anatomical region individually
  for (const key of ANATOMICAL_REGION_KEYS_V3) {
    const region = regions[key];
    const rQuality = assessRegionQuality(region, face);

    const featureResults: RegionReportV3['features'] = {};
    for (const f of featuresToRun) {
      featureResults[f] = measureRegionFeature(f, region, rQuality, ctx);
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
      quality: rQuality,
      features: featureResults,
      outline: region.outlineSource,
      unavailableReasons: region.unavailableReasons,
    };
  }

  // 2. Aggregate Feature Summaries across regions
  const featureSummaries = {} as Record<FeatureKeyV3, FeatureSummaryV3>;
  const legacyAnalysis = {} as Record<MetricKey, MetricResult>;

  const legacyMetricKeys: MetricKey[] = [
    'pigmentation',
    'redness',
    'texture',
    'blemishes',
    'shine',
    'underEye',
  ];

  for (const f of featuresToRun) {
    const measuredList: { regionKey: RegionKeyV3; score: number; confidence: number; weight: number }[] = [];

    for (const key of ANATOMICAL_REGION_KEYS_V3) {
      const res = regionsV3[key].features[f];
      if (res && res.status === 'measured' && res.score !== null && res.confidence !== null) {
        // Weight by region usable skin area
        const weight = Math.max(1, regionsV3[key].areaMm2);
        measuredList.push({ regionKey: key, score: res.score, confidence: res.confidence, weight });
      }
    }

    let overallScore: number | null = null;
    let overallConf = 0;
    const prominent: RegionKeyV3[] = [];

    if (measuredList.length > 0) {
      let weightedScoreSum = 0;
      let weightedConfSum = 0;
      let totalWeight = 0;

      for (const item of measuredList) {
        weightedScoreSum += item.score * item.weight;
        weightedConfSum += item.confidence * item.weight;
        totalWeight += item.weight;
      }

      overallScore = totalWeight > 0 ? Math.round(weightedScoreSum / totalWeight) : 0;
      overallConf = totalWeight > 0 ? Math.round((weightedConfSum / totalWeight) * 100) / 100 : 0;

      // Identify prominent regions (top 2 highest scores)
      measuredList.sort((a, b) => b.score - a.score);
      for (let i = 0; i < Math.min(2, measuredList.length); i++) {
        if (measuredList[i].score >= 25) prominent.push(measuredList[i].regionKey);
      }
    }

    const featureStatus: FeatureStatusV3 = measuredList.length > 0 ? 'measured' : 'unavailable';
    const overallScoreBand = overallScore !== null ? band(overallScore) : null;
    const confLabel = confidenceLabel(overallConf);

    featureSummaries[f] = {
      feature: f,
      status: featureStatus,
      overallScore,
      overallBand: overallScoreBand,
      overallConfidence: overallConf,
      overallConfidenceLabel: confLabel,
      prominentRegions: prominent,
      measuredRegionCount: measuredList.length,
      totalRegionCount: ANATOMICAL_REGION_KEYS_V3.length,
    };

    // If it's one of the 6 legacy metrics, construct backward-compatible MetricResult
    if (legacyMetricKeys.includes(f as MetricKey)) {
      const mKey = f as MetricKey;
      let explanation = '';
      if (overallScore === null) {
        explanation =
          locale === 'ar'
            ? 'تعذر قياس هذه الخاصية بدقة كافية في هذه الصورة.'
            : 'This feature could not be measured reliably from this photo.';
      } else {
        const bandText = overallScoreBand ?? 'minimal';
        explanation =
          locale === 'ar'
            ? `مستوى ${bandText} لوضوح هذه الخاصية على البشرة في هذه الصورة.`
            : `A ${bandText} level of this visual characteristic was observed.`;
      }

      // Map v3 prominent regions into legacy region keys
      const legacyRegions = mapV3RegionsToLegacy(prominent);

      legacyAnalysis[mKey] = {
        score: overallScore,
        band: overallScoreBand,
        confidence: overallConf,
        confidenceLabel: confLabel,
        explanation,
        regions: legacyRegions.length ? legacyRegions : undefined,
      };
    }
  }

  // Calculate overall analysis confidence across all core metrics
  let confSum = 0;
  for (const k of legacyMetricKeys) confSum += legacyAnalysis[k].confidence;
  const overallConfidence = Math.round((confSum / legacyMetricKeys.length) * 100) / 100;

  return {
    regionsV3,
    featureSummaries,
    legacyAnalysis,
    overallConfidence,
  };
}

/** Maps fine v3 anatomical keys into legacy 9 core regions. */
function mapV3RegionsToLegacy(v3Keys: RegionKeyV3[]): import('./types').RegionKey[] {
  const result = new Set<import('./types').RegionKey>();
  for (const k of v3Keys) {
    if (k.startsWith('forehead') || k === 'glabella') result.add('forehead');
    else if (k.startsWith('nose') || k.startsWith('nasal') || k.startsWith('alar')) result.add('nose');
    else if (k === 'cheekLeft' || k === 'templeLeft') result.add('cheekL');
    else if (k === 'cheekRight' || k === 'templeRight') result.add('cheekR');
    else if (k.startsWith('chin')) result.add('chin');
    else if (k === 'underEyeLeft') result.add('underEyeL');
    else if (k === 'underEyeRight') result.add('underEyeR');
    else if (k === 'jawlineLeft') result.add('jawL');
    else if (k === 'jawlineRight') result.add('jawR');
  }
  return Array.from(result);
}
