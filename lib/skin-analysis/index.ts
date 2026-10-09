import { randomUUID } from 'node:crypto';
import { alignFace, sourceIod, type AlignedFace } from './alignment';
import { confidenceLabel, metricConfidence, MIN_REPORTABLE, overallConfidence } from './confidence';
import { qualityFailure, ScanError } from './errors';
import { explain, prominentRegions } from './explain';
import { detectFaces } from './face-detection';
import { ENGINE_NAME } from '../brand';
import type { Locale } from '../i18n';
import { rgbToLabImage } from './image/color';
import { decodeImage, type RgbImage } from './image/decode';
import { applyAffine } from './image/warp';
import { detectLandmarks } from './landmarks';
import { measureBlemishes } from './metrics/blemishes';
import type { MetricContext, MetricMeasurement } from './metrics/common';
import { measurePigmentation } from './metrics/pigmentation';
import { measureRedness } from './metrics/redness';
import { measureShine } from './metrics/shine';
import { measureTexture } from './metrics/texture';
import { measureUnderEye } from './metrics/under-eye';
import { runExtensions, type ExtensionResults } from './extensions';
import { PALETTES, renderHeatmap } from './extensions/projection';
import { assessAlignedFace, checkDetections, checkLandmarks, type QualityAssessment } from './quality';
import { buildRegions } from './regions';
import { buildAnatomicalRegionsV3 } from './regions-v3';
import { aggregateV3Analysis } from './aggregation-v3';
import { band, calibrate, METHODOLOGY_VERSION } from './scoring';
import { buildSkinMasks } from './skin-mask';
import { analysisText } from './text';
import {
  ALL_REGION_KEYS,
  HEATMAP_KEYS,
  METRIC_KEYS,
  type HeatmapKey,
  type MetricKey,
  type MetricResult,
  type QualityIssueCode,
  type RegionOutline,
  type ScanSuccess,
} from './types';

/**
 * The skin-scan pipeline:
 *
 *   decode → face detection → landmarks → quality checks (pose, size, framing)
 *   → aligned face crop + segmentation → regions & skin masks
 *   → quality checks (exposure, sharpness, lighting, filters, glasses, occlusion)
 *   → metrics → calibration → confidence → explanations
 *
 * A photo that fails a quality check raises a ScanError with retake guidance
 * instead of producing a low-quality result.
 */

export interface AnalyzeOptions {
  maxInputPixels: number;
  maxSide: number;
  /** Epoch ms after which the scan is abandoned. */
  deadline: number;
  /** Language of the explanations (default English). */
  locale?: Locale;
}

export interface DetailedAnalysis {
  result: ScanSuccess;
  measurements: MetricMeasurement[];
  quality: QualityAssessment;
  face: Pick<AlignedFace, 'width' | 'height' | 'pxPerMm' | 'sourceIod'>;
  extensions: ExtensionResults['internal'];
}

/** Metrics whose measurement is distorted by smiling (cheek folds, raised under-eyes). */
const EXPRESSION_SENSITIVE: MetricKey[] = ['pigmentation', 'texture', 'underEye'];

/** Most actionable problem first; at most two are reported to the user. */
const ISSUE_PRIORITY: QualityIssueCode[] = [
  'sunglasses',
  'glasses',
  'blurry',
  'filter_detected',
  'not_color',
  'too_dark',
  'too_bright',
  'uneven_lighting',
  'face_obstructed',
  'insufficient_skin',
];

/**
 * Sclera luminance (75th percentile, linear) of a well-exposed photo: the
 * median over the reference portraits was L* ≈ 75, i.e. Y ≈ 0.48.
 */
const REFERENCE_SCLERA_Y = 0.48;

export function exposureGain(scleraY: number): number {
  if (!Number.isFinite(scleraY) || scleraY <= 0) return 1;
  return Math.min(2.5, Math.max(0.5, REFERENCE_SCLERA_Y / scleraY));
}

function checkDeadline(deadline: number): void {
  if (Date.now() > deadline) throw new ScanError('timeout');
}

/** Yield to the event loop between CPU-heavy stages so the server stays responsive. */
const yieldToEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve));

function outlines(face: AlignedFace, image: RgbImage, regions: ReturnType<typeof buildRegions>): RegionOutline[] {
  return ALL_REGION_KEYS.map((region) => ({
    region,
    points: regions.outlines[region].map(([x, y]) => {
      const [xs, ys] = applyAffine(face.cropToSource, x, y);
      return [
        Math.round((xs / image.width) * 10000) / 10000,
        Math.round((ys / image.height) * 10000) / 10000,
      ] as [number, number];
    }),
  }));
}

export async function analyzeImageDetailed(buffer: Buffer, options: AnalyzeOptions): Promise<DetailedAnalysis> {
  const pipelineStart = Date.now();
  const image = await decodeImage(buffer, { maxInputPixels: options.maxInputPixels, maxSide: options.maxSide });
  checkDeadline(options.deadline);

  const detections = await detectFaces(image);
  const detectionIssue = checkDetections(detections);
  if (detectionIssue) throw qualityFailure(detectionIssue);
  checkDeadline(options.deadline);

  const landmarks = await detectLandmarks(image, detections[0]);
  const iod = sourceIod(landmarks.points);
  const { issue: landmarkIssue, pose } = checkLandmarks(landmarks, iod, image.width, image.height);
  if (landmarkIssue) throw qualityFailure(landmarkIssue);
  checkDeadline(options.deadline);

  const face = await alignFace(image, landmarks.points);
  await yieldToEventLoop();
  checkDeadline(options.deadline);

  const regions = buildRegions(face.landmarks);
  const masks = buildSkinMasks(face, regions);
  const quality = assessAlignedFace(face, regions, masks.geometric, masks.all, pose);
  if (quality.issues.length) {
    const ordered = ISSUE_PRIORITY.filter((c) => quality.issues.includes(c)).slice(0, 2);
    const failure = qualityFailure(...ordered);
    failure.diagnostics = quality.diagnostics;
    throw failure;
  }
  await yieldToEventLoop();
  checkDeadline(options.deadline);

  // V3 Anatomical Facial Regions and independent regional measurements
  const anatomicalV3 = buildAnatomicalRegionsV3(face.landmarks, face, image.width, image.height);
  const locale = options.locale ?? 'en';
  const v3Aggregate = aggregateV3Analysis(face, anatomicalV3, quality, locale);

  // Exposure normalisation: colour contrasts in CIELAB scale with exposure, so
  // the photo is brought to a reference exposure using the eye whites, whose
  // brightness does not depend on skin tone. Gating above used the raw values.
  const scleraY = quality.diagnostics.scleraY;
  const gain = exposureGain(scleraY);
  if (gain !== 1) face.lab = rgbToLabImage(face.rgb, face.width * face.height, gain);
  quality.diagnostics.exposureGain = gain;
  const illumination = Number.isFinite(scleraY) && scleraY > 0 ? scleraY * gain : 0.6;
  const ctx: MetricContext = { face, masks, quality, cache: new Map(), locale };
  const steps: ((c: MetricContext) => MetricMeasurement)[] = [
    measurePigmentation,
    measureRedness,
    measureTexture,
    measureBlemishes,
    (c) => measureShine(c, illumination),
    measureUnderEye,
  ];
  const measurements: MetricMeasurement[] = [];
  for (const step of steps) {
    measurements.push(step(ctx));
    await yieldToEventLoop();
    checkDeadline(options.deadline);
  }

  const analysis = {} as Record<MetricKey, MetricResult>;
  const confidences: number[] = [];
  for (const m of measurements) {
    const confidence = metricConfidence(m, quality.factors);
    confidences.push(confidence);
    const reportable = m.raw !== null && confidence >= MIN_REPORTABLE;
    // Say why a metric was withheld when the expression is the main reason.
    if (!reportable && m.raw !== null && quality.factors.expression < 0.5 && EXPRESSION_SENSITIVE.includes(m.key)) {
      m.insufficientReason = 'expression';
    }
    const score = reportable ? calibrate(m.key, m.raw as number) : null;
    const scoreBand = score === null ? null : band(score);
    const regionsShown = score !== null && score >= 25 ? prominentRegions(m) : [];
    const rounded = Math.round(confidence * 100) / 100;
    analysis[m.key] = {
      score,
      band: scoreBand,
      confidence: rounded,
      confidenceLabel: reportable ? confidenceLabel(confidence) : 'insufficient',
      explanation: explain(m, score, scoreBand, regionsShown, locale),
      ...(regionsShown.length ? { regions: regionsShown } : {}),
    };
  }
  // Keep a stable key order for clients.
  const ordered = Object.fromEntries(METRIC_KEYS.map((k) => [k, analysis[k]])) as Record<MetricKey, MetricResult>;

  // Extension components (acne spot candidates, pores, optional models). They
  // run after the core analysis and cannot change or break it.
  checkDeadline(options.deadline);
  const notes = quality.notes.map((code) => analysisText(locale).notes[code]);
  const ext = await runExtensions(ctx, image, notes);
  const heatmaps = await metricHeatmaps(face, image, measurements, ordered);

  const result: ScanSuccess = {
    success: true,
    scanId: randomUUID(),
    createdAt: new Date().toISOString(),
    analysis: ordered,
    overallConfidence: Math.round(overallConfidence(confidences) * 100) / 100,
    imageQuality: { acceptable: true, notes },
    regions: outlines(face, image, regions),
    engine: ENGINE_NAME,
    methodologyVersion: METHODOLOGY_VERSION,
    acne: ext.acne,
    pores: ext.pores,
    skinAge: ext.skinAge,
    heatmaps,
    dermFoundation: ext.dermFoundation,
    analysisQuality: ext.analysisQuality,
    regionsV3: v3Aggregate.regionsV3,
    v3: {
      engineVersion: '3.0.0',
      methodologyVersion: '3.0.0',
      imageQuality: {
        acceptable: true,
        issues: quality.issues,
        notes,
      },
      faceGeometry: {
        iodPx: Math.round(face.sourceIod * 10) / 10,
        pxPerMm: Math.round(face.pxPerMm * 100) / 100,
        yaw: Math.round(pose.yaw * 10) / 10,
        pitch: Math.round(pose.pitch * 10) / 10,
        roll: Math.round(pose.roll * 10) / 10,
      },
      regions: v3Aggregate.regionsV3,
      featureSummaries: v3Aggregate.featureSummaries,
      executionMs: Date.now() - pipelineStart,
    },
  };
  return {
    result,
    measurements,
    quality,
    face: { width: face.width, height: face.height, pxPerMm: face.pxPerMm, sourceIod: face.sourceIod },
    extensions: ext.internal,
  };
}

/**
 * Heatmaps of where each reported characteristic was seen: every pixel's
 * value goes through the metric's own calibration, so colours mean the same
 * as the score (a pixel at 50 looks like a score of 50 there). A failed
 * heatmap is left out; it never affects the scores.
 */
async function metricHeatmaps(
  face: AlignedFace,
  image: RgbImage,
  measurements: MetricMeasurement[],
  analysis: Record<MetricKey, MetricResult>,
): Promise<Partial<Record<HeatmapKey, string>>> {
  const out: Partial<Record<HeatmapKey, string>> = {};
  for (const key of HEATMAP_KEYS) {
    const m = measurements.find((x) => x.key === key);
    if (!m?.map || analysis[key].score === null) continue;
    const values = new Float32Array(m.map.length);
    for (let i = 0; i < values.length; i++) if (m.map[i] > 0) values[i] = calibrate(key, m.map[i]) / 100;
    try {
      out[key] = await renderHeatmap(face, image, values, PALETTES[key]);
    } catch {
      // Leave this heatmap out.
    }
  }
  return out;
}

export async function analyzeImage(buffer: Buffer, options: AnalyzeOptions): Promise<ScanSuccess> {
  return (await analyzeImageDetailed(buffer, options)).result;
}

export { ScanError } from './errors';
export type { ScanResponse, ScanSuccess, ScanFailure } from './types';
