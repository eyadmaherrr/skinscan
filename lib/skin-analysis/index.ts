import { randomUUID } from 'node:crypto';
import { alignFace, sourceIod, type AlignedFace } from './alignment';
import { confidenceLabel, metricConfidence, MIN_REPORTABLE, overallConfidence } from './confidence';
import { qualityFailure, ScanError } from './errors';
import { explain, prominentRegions } from './explain';
import { detectFaces } from './face-detection';
import { ENGINE_NAME } from '../brand';
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
import { assessAlignedFace, checkDetections, checkLandmarks, type QualityAssessment } from './quality';
import { buildRegions } from './regions';
import { band, calibrate, METHODOLOGY_VERSION } from './scoring';
import { buildSkinMasks } from './skin-mask';
import {
  METRIC_KEYS,
  REGION_KEYS,
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
}

export interface DetailedAnalysis {
  result: ScanSuccess;
  measurements: MetricMeasurement[];
  quality: QualityAssessment;
  face: Pick<AlignedFace, 'width' | 'height' | 'pxPerMm' | 'sourceIod'>;
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
  return REGION_KEYS.map((region) => ({
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

  // Exposure normalisation: colour contrasts in CIELAB scale with exposure, so
  // the photo is brought to a reference exposure using the eye whites, whose
  // brightness does not depend on skin tone. Gating above used the raw values.
  const scleraY = quality.diagnostics.scleraY;
  const gain = exposureGain(scleraY);
  if (gain !== 1) face.lab = rgbToLabImage(face.rgb, face.width * face.height, gain);
  quality.diagnostics.exposureGain = gain;
  const illumination = Number.isFinite(scleraY) && scleraY > 0 ? scleraY * gain : 0.6;
  const ctx: MetricContext = { face, masks, quality, cache: new Map() };
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
      explanation: explain(m, score, scoreBand, regionsShown),
      ...(regionsShown.length ? { regions: regionsShown } : {}),
    };
  }
  // Keep a stable key order for clients.
  const ordered = Object.fromEntries(METRIC_KEYS.map((k) => [k, analysis[k]])) as Record<MetricKey, MetricResult>;

  const result: ScanSuccess = {
    success: true,
    scanId: randomUUID(),
    createdAt: new Date().toISOString(),
    analysis: ordered,
    overallConfidence: Math.round(overallConfidence(confidences) * 100) / 100,
    imageQuality: { acceptable: true, notes: quality.notes },
    regions: outlines(face, image, regions),
    engine: ENGINE_NAME,
    methodologyVersion: METHODOLOGY_VERSION,
  };
  return {
    result,
    measurements,
    quality,
    face: { width: face.width, height: face.height, pxPerMm: face.pxPerMm, sourceIod: face.sourceIod },
  };
}

export async function analyzeImage(buffer: Buffer, options: AnalyzeOptions): Promise<ScanSuccess> {
  return (await analyzeImageDetailed(buffer, options)).result;
}

export { ScanError } from './errors';
export type { ScanResponse, ScanSuccess, ScanFailure } from './types';
