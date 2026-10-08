import type { AlignedFace } from './alignment';
import type { FaceDetection } from './face-detection';
import { FACE_OVAL, IRIS_RING_IMG_LEFT, IRIS_RING_IMG_RIGHT, LM } from './face-topology';
import type { FaceLandmarks } from './landmarks';
import { chroma, hueAngle, individualTypologyAngle } from './image/color';
import { bandContrast } from './image/detail';
import { downsample, downsampleMask, erode, estimateNoiseSigma } from './image/filters';
import { countMask, maskedValues, median, quantiles, ramp } from './image/stats';
import type { FaceRegions } from './regions';
import type { QualityIssueCode } from './types';

/**
 * Image-quality gate. Every check is designed to be independent of skin
 * tone: exposure is judged from clipping, from the eye whites (sclera) and
 * from sensor noise — not from how bright the skin is — and lighting balance
 * is judged from luminance *ratios*, which do not depend on skin reflectance.
 * Thresholds are documented in docs/SCORING.md and were checked with
 * `npm run evaluate`.
 */

export const QUALITY_THRESHOLDS = {
  minSourceIod: 70,
  multipleFaceScore: 0.6,
  multipleFaceAreaRatio: 0.2,
  minLandmarkPresence: 0.5,
  maxOutsideFraction: 0.04,
  maxYawDeg: 24,
  maxPitchDeg: 25,
  maxRollDeg: 30,
  maxClippedFraction: 0.15,
  maxCrushedFraction: 0.2,
  minScleraL: 32,
  minSkinL: 10,
  minSnr: 5,
  maxCheekLuminanceRatio: 3.5,
  maxBlurIndex: 0.62,
  minSkinChroma: 4,
  skinHueRange: [5, 95] as [number, number],
  maxOccludedFraction: 0.3,
  sunglassesEyeFraction: 0.5,
  glassesSurroundFraction: 0.04,
  minSkinCoverage: 0.35,
  minFineDetail: 0.007,
  maxSkinDetail: 0.09,
} as const;

export interface QualityFactors {
  /** 1 = sharp, 0 = at the rejection limit. */
  sharpness: number;
  /** Penalises clipping, dark exposure and low signal-to-noise. */
  exposure: number;
  /** Penalises one-sided lighting. */
  lighting: number;
  /** Penalises head rotation. */
  pose: number;
  /** Physical resolution available for fine detail (texture, spots). */
  resolution: number;
  /** 1 = natural detail present, 0 = skin looks artificially smoothed. */
  naturalDetail: number;
  /** Penalises noise for fine-detail metrics. */
  noise: number;
  /** 1 = neutral expression; smiling folds the cheeks and adds shading. */
  expression: number;
}

export interface QualityAssessment {
  issues: QualityIssueCode[];
  notes: string[];
  factors: QualityFactors;
  diagnostics: Record<string, number>;
}

/** Checks that only need the detector output. */
export function checkDetections(detections: FaceDetection[]): QualityIssueCode | null {
  if (detections.length === 0) return 'no_face';
  const main = detections[0];
  const mainArea = main.width * main.height;
  const others = detections
    .slice(1)
    .filter(
      (d) =>
        d.score >= QUALITY_THRESHOLDS.multipleFaceScore &&
        d.width * d.height >= QUALITY_THRESHOLDS.multipleFaceAreaRatio * mainArea,
    );
  return others.length > 0 ? 'multiple_faces' : null;
}

export interface Pose {
  yaw: number;
  pitch: number;
  roll: number;
}

/** Approximate head pose (degrees) from the 3D landmarks. */
export function estimatePose(points: Float32Array): Pose {
  const p = (i: number) => [points[i * 3], points[i * 3 + 1], points[i * 3 + 2]];
  const [lx, ly, lz] = p(LM.faceSideImgLeft);
  const [rx, ry, rz] = p(LM.faceSideImgRight);
  const yaw = (Math.atan2(rz - lz, Math.hypot(rx - lx, ry - ly)) * 180) / Math.PI;
  const [, ty, tz] = p(LM.foreheadTop);
  const [, cy, cz] = p(LM.chin);
  const pitch = (Math.atan2(cz - tz, cy - ty) * 180) / Math.PI;
  const [ax, ay] = p(LM.eyeOuterImgLeft);
  const [bx, by] = p(LM.eyeOuterImgRight);
  const roll = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  return { yaw, pitch, roll };
}

/** Checks on the landmarks in source-image coordinates. */
export function checkLandmarks(
  landmarks: FaceLandmarks,
  sourceIod: number,
  width: number,
  height: number,
): { issue: QualityIssueCode | null; pose: Pose } {
  const pose = estimatePose(landmarks.points);
  if (landmarks.presence < QUALITY_THRESHOLDS.minLandmarkPresence) return { issue: 'no_face', pose };
  let outside = 0;
  const tolX = width * 0.005;
  const tolY = height * 0.005;
  for (const i of FACE_OVAL) {
    const x = landmarks.points[i * 3];
    const y = landmarks.points[i * 3 + 1];
    if (x < -tolX || y < -tolY || x > width + tolX || y > height + tolY) outside++;
  }
  if (outside / FACE_OVAL.length > QUALITY_THRESHOLDS.maxOutsideFraction) return { issue: 'face_cropped', pose };
  if (sourceIod < QUALITY_THRESHOLDS.minSourceIod) return { issue: 'face_too_small', pose };
  if (
    Math.abs(pose.yaw) > QUALITY_THRESHOLDS.maxYawDeg ||
    Math.abs(pose.pitch) > QUALITY_THRESHOLDS.maxPitchDeg ||
    Math.abs(pose.roll) > QUALITY_THRESHOLDS.maxRollDeg
  ) {
    return { issue: 'face_angle', pose };
  }
  return { issue: null, pose };
}

/**
 * Expression from the mouth landmarks (aligned crop, IOD units): a wide,
 * open or upturned mouth means the person is smiling, which creases the
 * cheeks (smile folds) and pushes the under-eye skin up.
 */
export function smileScore(face: AlignedFace): { smile: number; mouthWidth: number; opening: number; cornerLift: number } {
  const { xy, iod } = face.landmarks;
  const pt = (i: number) => [xy[i * 2], xy[i * 2 + 1]];
  const [lx, ly] = pt(LM.mouthCornerImgLeft);
  const [rx, ry] = pt(LM.mouthCornerImgRight);
  const [, uy] = pt(LM.upperLipInner);
  const [, dy] = pt(LM.lowerLipInner);
  const [, ty] = pt(LM.upperLipTop);
  const [, by] = pt(LM.lowerLipBottom);
  const mouthWidth = Math.hypot(rx - lx, ry - ly) / iod;
  const opening = Math.max(0, dy - uy) / iod;
  const cornerLift = ((ty + by) / 2 - (ly + ry) / 2) / iod;
  const smile = Math.max(ramp(0.9, 1.1, mouthWidth), ramp(0.06, 0.16, opening), ramp(0.02, 0.1, cornerLift));
  return { smile, mouthWidth, opening, cornerLift };
}

/**
 * Blur index after Crété-Roffet et al. (2007), "The blur effect: perception
 * and estimation with a new no-reference perceptual blur metric". The image is
 * re-blurred; a sharp image loses much of its pixel-to-pixel variation, an
 * already blurry one barely changes. 0 = sharp, 1 = maximally blurred.
 */
export function blurIndex(plane: Float32Array, mask: Uint8Array, w: number, h: number): number {
  const k = 4; // 9-tap box re-blur
  let sumDH = 0;
  let sumVH = 0;
  let sumDV = 0;
  let sumVV = 0;
  const blurredH = new Float32Array(plane.length);
  const blurredV = new Float32Array(plane.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let accH = 0;
      let accV = 0;
      for (let t = -k; t <= k; t++) {
        accH += plane[y * w + Math.min(w - 1, Math.max(0, x + t))];
        accV += plane[Math.min(h - 1, Math.max(0, y + t)) * w + x];
      }
      blurredH[y * w + x] = accH / (2 * k + 1);
      blurredV[y * w + x] = accV / (2 * k + 1);
    }
  }
  for (let y = 1; y < h; y++) {
    for (let x = 1; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const dH = Math.abs(plane[i] - plane[i - 1]);
      const dHb = Math.abs(blurredH[i] - blurredH[i - 1]);
      const dV = Math.abs(plane[i] - plane[i - w]);
      const dVb = Math.abs(blurredV[i] - blurredV[i - w]);
      sumDH += dH;
      sumVH += Math.max(0, dH - dHb);
      sumDV += dV;
      sumVV += Math.max(0, dV - dVb);
    }
  }
  if (sumDH === 0 || sumDV === 0) return 1;
  return Math.max((sumDH - sumVH) / sumDH, (sumDV - sumVV) / sumDV);
}

function irisRadius(face: AlignedFace, ring: number[], centre: number): number {
  const { xy } = face.landmarks;
  const cx = xy[centre * 2];
  const cy = xy[centre * 2 + 1];
  let r = 0;
  for (const i of ring) r += Math.hypot(xy[i * 2] - cx, xy[i * 2 + 1] - cy);
  return r / ring.length;
}

/** Eye-white pixels: eye opening minus the iris disc, eroded away from lids and lashes. */
function scleraMask(face: AlignedFace, regions: FaceRegions): Uint8Array {
  const { width: w, height: h } = face;
  const eyes = erode(regions.eyes, w, h, Math.max(1, Math.round(face.landmarks.iod * 0.015)));
  const out = eyes.slice();
  const irises: [number, number[]][] = [
    [LM.irisImgLeft, IRIS_RING_IMG_LEFT],
    [LM.irisImgRight, IRIS_RING_IMG_RIGHT],
  ];
  for (const [centre, ring] of irises) {
    const cx = face.landmarks.xy[centre * 2];
    const cy = face.landmarks.xy[centre * 2 + 1];
    const r = irisRadius(face, ring, centre) * 1.25;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) out[y * w + x] = 0;
      }
    }
  }
  return out;
}

function fractionWhere(mask: Uint8Array, predicate: (i: number) => boolean): number {
  let n = 0;
  let hit = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    n++;
    if (predicate(i)) hit++;
  }
  return n ? hit / n : 0;
}

/**
 * Checks on the aligned face. `geometricSkin` is the union of the facial
 * regions before occlusion filtering; `usableSkin` is after filtering.
 */
export function assessAlignedFace(
  face: AlignedFace,
  regions: FaceRegions,
  geometricSkin: Uint8Array,
  usableSkin: Uint8Array,
  pose: Pose,
): QualityAssessment {
  const T = QUALITY_THRESHOLDS;
  const issues: QualityIssueCode[] = [];
  const notes: string[] = [];
  const { width: w, height: h, rgb, lab, seg } = face;
  const diagnostics: Record<string, number> = {};
  const skin = geometricSkin;

  // --- Exposure -----------------------------------------------------------
  const clipped = fractionWhere(skin, (i) => Math.max(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) >= 250);
  const crushed = fractionWhere(skin, (i) => Math.max(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) <= 12);
  const skinL = median(maskedValues(lab.L, skin));
  const sclera = scleraMask(face, regions);
  const scleraCount = countMask(sclera);
  const scleraL = scleraCount >= 20 ? quantiles(maskedValues(lab.L, sclera), [0.75])[0] : Number.NaN;
  diagnostics.scleraY = scleraCount >= 20 ? quantiles(maskedValues(lab.Y, sclera), [0.75])[0] : Number.NaN;
  const noiseSigma = estimateNoiseSigma(lab.Y, skin, w, h);
  const skinY = median(maskedValues(lab.Y, skin));
  const snr = noiseSigma > 0 ? skinY / noiseSigma : 100;
  Object.assign(diagnostics, { clipped, crushed, skinL, scleraL, scleraCount, snr, noiseSigma });

  // Blur smears the dark iris and lids into the eye whites, so the sclera is
  // only trusted as an exposure reference in reasonably sharp photos.
  const factor = Math.max(1, Math.round(face.landmarks.iod / 90));
  const small = downsample(lab.L, w, h, factor);
  const eyeArea = downsampleMask(regions.eyeSurround, w, h, factor);
  const blur = blurIndex(small.data, eyeArea, small.width, small.height);
  diagnostics.blurIndex = blur;
  const scleraUsable = !Number.isNaN(scleraL) && blur <= T.maxBlurIndex;

  if (clipped > T.maxClippedFraction) issues.push('too_bright');
  if (crushed > T.maxCrushedFraction || skinL < T.minSkinL || (scleraUsable && scleraL < T.minScleraL)) {
    issues.push('too_dark');
  } else if (snr < T.minSnr) {
    issues.push('too_dark');
  }
  const exposureFromSclera = scleraUsable ? ramp(T.minScleraL, 55, scleraL) : 0.85;
  const exposure = Math.min(
    ramp(T.maxClippedFraction, 0.02, clipped),
    ramp(T.maxCrushedFraction, 0.03, crushed),
    0.4 + 0.6 * exposureFromSclera,
  );

  // --- Lighting balance (ratio of cheek luminance) -----------------------
  const yL = median(maskedValues(lab.Y, regions.regions.cheekL));
  const yR = median(maskedValues(lab.Y, regions.regions.cheekR));
  const cheekRatio = yL > 0 && yR > 0 ? Math.max(yL, yR) / Math.min(yL, yR) : 1;
  diagnostics.cheekRatio = cheekRatio;
  if (cheekRatio > T.maxCheekLuminanceRatio) issues.push('uneven_lighting');
  else if (cheekRatio > 2) notes.push('One side of your face was more brightly lit than the other.');
  const lighting = ramp(T.maxCheekLuminanceRatio, 1.4, cheekRatio);

  // --- Sharpness (eye area, canonical scale; computed above) -------------
  if (blur > T.maxBlurIndex) issues.push('blurry');
  const sharpness = ramp(T.maxBlurIndex, 0.38, blur);

  // --- Colour / filters ---------------------------------------------------
  const aMed = median(maskedValues(lab.a, skin));
  const bMed = median(maskedValues(lab.b, skin));
  const skinChroma = chroma(aMed, bMed);
  const skinHue = hueAngle(aMed, bMed);
  // Skin-tone angle: recorded for fairness evaluation only, never used for scoring.
  Object.assign(diagnostics, { skinChroma, skinHue, skinITA: individualTypologyAngle(skinL, bMed) });
  if (skinChroma < T.minSkinChroma || skinHue < T.skinHueRange[0] || skinHue > T.skinHueRange[1]) {
    issues.push('not_color');
  }

  // Natural-detail check (noise-corrected, so darker skin and dim light are not penalised):
  //  - beauty filters remove fine skin detail while the eyes stay sharp;
  //  - heavy sharpening / "clarity" / HDR edits exaggerate it far beyond real skin.
  const p = face.pxPerMm;
  const fine = bandContrast(lab.logY, usableSkin, w, h, Math.max(0.5, 0.15 * p), Math.max(1.2, 0.6 * p)).corrected;
  const mid = bandContrast(lab.logY, usableSkin, w, h, Math.max(0.5, 0.2 * p), Math.max(1.2, 1.0 * p)).corrected;
  Object.assign(diagnostics, { skinFineDetail: fine, skinMidDetail: mid });
  const checkDetail = p >= 3 && blur <= T.maxBlurIndex;
  const naturalDetail = checkDetail ? Math.min(ramp(T.minFineDetail, 0.018, fine), ramp(T.maxSkinDetail, 0.05, mid)) : 1;
  if (checkDetail && (fine < T.minFineDetail || mid > T.maxSkinDetail)) issues.push('filter_detected');

  // --- Glasses, occlusion and visible skin --------------------------------
  const eyeAccessory = fractionWhere(regions.eyes, (i) => seg.others[i] >= 0.5);
  // Thin frames get only partial "accessory" probability, so a lower cut-off is used around the eyes.
  const surroundAccessory = fractionWhere(regions.eyeSurround, (i) => seg.others[i] >= 0.3);
  Object.assign(diagnostics, { eyeAccessory, surroundAccessory });
  if (eyeAccessory > T.sunglassesEyeFraction && (Number.isNaN(scleraL) || scleraL < 45)) issues.push('sunglasses');
  else if (surroundAccessory > T.glassesSurroundFraction || eyeAccessory > T.sunglassesEyeFraction) issues.push('glasses');

  const interior = new Uint8Array(w * h);
  for (let i = 0; i < interior.length; i++) interior[i] = regions.faceOval[i] && !regions.features[i] ? 1 : 0;
  const occluded = fractionWhere(
    interior,
    (i) => seg.others[i] >= 0.5 || seg.background[i] >= 0.6 || seg.clothes[i] >= 0.5 || seg.bodySkin[i] >= 0.7,
  );
  diagnostics.occluded = occluded;
  if (occluded > T.maxOccludedFraction) issues.push('face_obstructed');

  const geometricCount = countMask(geometricSkin);
  const coverage = geometricCount ? countMask(usableSkin) / geometricCount : 0;
  diagnostics.coverage = coverage;
  if (coverage < T.minSkinCoverage) issues.push('insufficient_skin');
  else if (coverage < 0.7) notes.push('Some areas were covered (for example by hair) and were not analysed.');

  // --- Pose, resolution, noise --------------------------------------------
  const poseFactor = Math.min(
    ramp(T.maxYawDeg, 8, Math.abs(pose.yaw)),
    ramp(T.maxPitchDeg, 10, Math.abs(pose.pitch)),
  );
  const resolution = ramp(1.5, 6, face.pxPerMm);
  if (face.pxPerMm < 3) notes.push('Photo resolution limited the measurement of fine detail such as texture.');
  const noise = ramp(T.minSnr, 40, snr);
  const expr = smileScore(face);
  Object.assign(diagnostics, { smile: expr.smile, mouthWidth: expr.mouthWidth, mouthOpening: expr.opening, cornerLift: expr.cornerLift });
  if (expr.smile > 0.5) notes.push('Smiling creates skin folds that can affect some results; a neutral expression gives the most reliable scan.');
  const expression = 1 - expr.smile;
  Object.assign(diagnostics, { yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll, pxPerMm: face.pxPerMm });

  return {
    issues: Array.from(new Set(issues)),
    notes,
    factors: { sharpness, exposure, lighting, pose: poseFactor, resolution, naturalDetail, noise, expression },
    diagnostics,
  };
}
