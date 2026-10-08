import { dilate, erode } from './image/filters';
import { and, andNot, fillPolygon, lerp, type Point } from './geometry';
import {
  BROW_LOWER_IMG_LEFT,
  BROW_LOWER_IMG_RIGHT,
  BROW_UPPER_IMG_LEFT,
  BROW_UPPER_IMG_RIGHT,
  EYE_IMG_LEFT,
  EYE_IMG_RIGHT,
  FACE_OVAL,
  FOREHEAD_ARC,
  LIPS_OUTER,
  LM,
  LOWER_LID_IMG_LEFT,
  LOWER_LID_IMG_RIGHT,
} from './face-topology';
import { ALL_REGION_KEYS, type RegionKey } from './types';

/**
 * Facial regions are defined from the landmarks in the aligned face crop
 * (eyes horizontal). Distances are expressed as fractions of the
 * inter-ocular distance (IOD) so the regions scale with the face.
 */

export interface AlignedLandmarks {
  /** x, y pairs (crop pixel coordinates) for the 478 landmarks. */
  xy: Float32Array;
  width: number;
  height: number;
  /** Distance between the eye centres, in crop pixels. */
  iod: number;
}

export interface FaceRegions {
  /** Geometric region masks (before skin/occlusion filtering). */
  regions: Record<RegionKey, Uint8Array>;
  /** Region outlines (crop coordinates), for display. */
  outlines: Record<RegionKey, Point[]>;
  /** Face oval. */
  faceOval: Uint8Array;
  /** Eyes, brows and lips, dilated — never analysed as skin. */
  features: Uint8Array;
  /** Eye openings only (for sclera / glasses checks). */
  eyes: Uint8Array;
  /** Area around the eyes where glasses frames would sit. */
  eyeSurround: Uint8Array;
}

export function point(lm: AlignedLandmarks, index: number): Point {
  return [lm.xy[index * 2], lm.xy[index * 2 + 1]];
}

function points(lm: AlignedLandmarks, indices: readonly number[]): Point[] {
  return indices.map((i) => point(lm, i));
}

function shift(pts: Point[], dx: number, dy: number): Point[] {
  return pts.map(([x, y]) => [x + dx, y + dy]);
}

function mask(lm: AlignedLandmarks, poly: Point[]): Uint8Array {
  const m = new Uint8Array(lm.width * lm.height);
  fillPolygon(m, lm.width, lm.height, poly);
  return m;
}

function eyeCentre(lm: AlignedLandmarks, outer: number, inner: number): Point {
  const a = point(lm, outer);
  const b = point(lm, inner);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function buildRegions(lm: AlignedLandmarks): FaceRegions {
  const { width: w, height: h, iod } = lm;
  const px = (f: number) => f * iod;

  const faceOvalPoly = points(lm, FACE_OVAL);
  const faceOval = mask(lm, faceOvalPoly);
  const faceInner = erode(faceOval, w, h, Math.max(1, Math.round(px(0.04))));

  // Features excluded from every region.
  const eyes = new Uint8Array(w * h);
  fillPolygon(eyes, w, h, points(lm, EYE_IMG_LEFT));
  fillPolygon(eyes, w, h, points(lm, EYE_IMG_RIGHT));
  const brows = new Uint8Array(w * h);
  fillPolygon(brows, w, h, [...points(lm, BROW_UPPER_IMG_LEFT), ...points(lm, BROW_LOWER_IMG_LEFT).reverse()]);
  fillPolygon(brows, w, h, [...points(lm, BROW_UPPER_IMG_RIGHT), ...points(lm, BROW_LOWER_IMG_RIGHT).reverse()]);
  const lips = mask(lm, points(lm, LIPS_OUTER));
  const features = new Uint8Array(w * h);
  const eyesDilated = dilate(eyes, w, h, Math.max(1, Math.round(px(0.07))));
  const browsDilated = dilate(brows, w, h, Math.max(1, Math.round(px(0.06))));
  const lipsDilated = dilate(lips, w, h, Math.max(1, Math.round(px(0.05))));
  for (let i = 0; i < features.length; i++) features[i] = eyesDilated[i] | browsDilated[i] | lipsDilated[i];
  const eyeSurround = andNot(dilate(eyes, w, h, Math.max(1, Math.round(px(0.22)))), brows);

  const midTop = point(lm, LM.noseBridge);
  const tip = point(lm, LM.noseTip);
  const eyeL = eyeCentre(lm, LM.eyeOuterImgLeft, LM.eyeInnerImgLeft);
  const eyeR = eyeCentre(lm, LM.eyeOuterImgRight, LM.eyeInnerImgRight);
  const eyeY = (eyeL[1] + eyeR[1]) / 2;
  const midXAt = (y: number) => {
    const t = (y - midTop[1]) / Math.max(1, tip[1] - midTop[1]);
    return lerp(midTop[0], tip[0], Math.max(0, Math.min(1.2, t)));
  };

  // Forehead: between the top of the face oval and the raised brow line.
  const browRaise = px(0.07);
  const forehead = [
    ...points(lm, FOREHEAD_ARC),
    ...shift(points(lm, BROW_UPPER_IMG_RIGHT), 0, -browRaise),
    ...shift(points(lm, BROW_UPPER_IMG_LEFT), 0, -browRaise).reverse(),
  ];

  // Nose: trapezoid along the nose midline, from below the eyes down to just above the tip.
  const noseTopY = eyeY + px(0.18);
  const noseBottomY = tip[1] - px(0.03);
  const nose: Point[] = [
    [midXAt(noseTopY) - px(0.09), noseTopY],
    [midXAt(noseTopY) + px(0.09), noseTopY],
    [midXAt(noseBottomY) + px(0.2), noseBottomY],
    [midXAt(noseBottomY) - px(0.2), noseBottomY],
  ];

  // Under-eye bands follow the lower lid.
  const lidL = points(lm, LOWER_LID_IMG_LEFT).slice(0, -1);
  const lidR = points(lm, LOWER_LID_IMG_RIGHT).slice(0, -1);
  const underEyeL = [...shift(lidL, 0, px(0.06)), ...shift(lidL, 0, px(0.26)).reverse()];
  const underEyeR = [...shift(lidR, 0, px(0.06)), ...shift(lidR, 0, px(0.26)).reverse()];

  // Cheeks: below the under-eye band, outside the nose / nasolabial line, down to the mouth corners.
  const lidBottomL = Math.max(...lidL.map((p) => p[1]));
  const lidBottomR = Math.max(...lidR.map((p) => p[1]));
  const mouthL = point(lm, LM.mouthCornerImgLeft);
  const mouthR = point(lm, LM.mouthCornerImgRight);
  const sideL = point(lm, LM.faceSideImgLeft);
  const sideR = point(lm, LM.faceSideImgRight);
  const cheekTopL = lidBottomL + px(0.3);
  const cheekTopR = lidBottomR + px(0.3);
  const cheekBottomL = mouthL[1];
  const cheekBottomR = mouthR[1];
  const cheekL: Point[] = [
    [sideL[0] - px(0.1), cheekTopL],
    [midXAt(cheekTopL) - px(0.3), cheekTopL],
    [mouthL[0] - px(0.1), cheekBottomL],
    [sideL[0] - px(0.1), cheekBottomL],
  ];
  const cheekR: Point[] = [
    [midXAt(cheekTopR) + px(0.3), cheekTopR],
    [sideR[0] + px(0.1), cheekTopR],
    [sideR[0] + px(0.1), cheekBottomR],
    [mouthR[0] + px(0.1), cheekBottomR],
  ];

  // Chin: below the lower lip, between the mouth corners, above the jaw line.
  const lowerLip = point(lm, LM.lowerLipBottom);
  const chinPt = point(lm, LM.chin);
  const chinTop = lowerLip[1] + px(0.1);
  const chinBottom = chinPt[1] - px(0.08);
  const chin: Point[] = [
    [mouthL[0] + px(0.04), chinTop],
    [mouthR[0] - px(0.04), chinTop],
    [mouthR[0] - px(0.08), chinBottom],
    [mouthL[0] + px(0.08), chinBottom],
  ];

  // Jawline (auxiliary, acne summary only): below the mouth-corner line, outside the chin.
  const jawTop = Math.max(mouthL[1], mouthR[1]) + px(0.06);
  const jawL: Point[] = [
    [sideL[0] - px(0.2), jawTop],
    [mouthL[0] - px(0.1), jawTop],
    [mouthL[0] - px(0.02), chinPt[1]],
    [sideL[0] - px(0.2), chinPt[1]],
  ];
  const jawR: Point[] = [
    [mouthR[0] + px(0.1), jawTop],
    [sideR[0] + px(0.2), jawTop],
    [sideR[0] + px(0.2), chinPt[1]],
    [mouthR[0] + px(0.02), chinPt[1]],
  ];

  const outlines: Record<RegionKey, Point[]> = {
    forehead,
    nose,
    cheekL,
    cheekR,
    chin,
    underEyeL,
    underEyeR,
    jawL,
    jawR,
  };

  const regions = {} as Record<RegionKey, Uint8Array>;
  for (const key of ALL_REGION_KEYS) {
    regions[key] = andNot(and(mask(lm, outlines[key]), faceInner), features);
  }
  // Keep regions disjoint: under-eye bands take precedence over cheeks and nose.
  const underEyes = new Uint8Array(w * h);
  for (let i = 0; i < underEyes.length; i++) underEyes[i] = regions.underEyeL[i] | regions.underEyeR[i];
  regions.cheekL = andNot(regions.cheekL, underEyes);
  regions.cheekR = andNot(regions.cheekR, underEyes);
  regions.nose = andNot(regions.nose, underEyes);
  regions.cheekL = andNot(regions.cheekL, regions.nose);
  regions.cheekR = andNot(regions.cheekR, regions.nose);
  for (const jaw of ['jawL', 'jawR'] as const) {
    regions[jaw] = andNot(andNot(andNot(regions[jaw], regions.chin), regions.cheekL), regions.cheekR);
  }

  return { regions, outlines, faceOval, features, eyes, eyeSurround };
}
