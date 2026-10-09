import { dilate, erode } from './image/filters';
import { and, andNot, fillPolygon, type Point } from './geometry';
import {
  BROW_LOWER_IMG_LEFT,
  BROW_LOWER_IMG_RIGHT,
  BROW_UPPER_IMG_LEFT,
  BROW_UPPER_IMG_RIGHT,
  EYE_IMG_LEFT,
  EYE_IMG_RIGHT,
  FACE_OVAL,
  LEGACY_PRIMARY_CONTOURS,
  LIPS_OUTER,
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

function mask(lm: AlignedLandmarks, poly: Point[]): Uint8Array {
  const m = new Uint8Array(lm.width * lm.height);
  fillPolygon(m, lm.width, lm.height, poly);
  return m;
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

  // Anatomical polygon outlines derived directly from MediaPipe Face Mesh landmark contours
  const outlines: Record<RegionKey, Point[]> = {
    forehead: points(lm, LEGACY_PRIMARY_CONTOURS.forehead),
    nose: points(lm, LEGACY_PRIMARY_CONTOURS.nose),
    cheekL: points(lm, LEGACY_PRIMARY_CONTOURS.cheekL),
    cheekR: points(lm, LEGACY_PRIMARY_CONTOURS.cheekR),
    chin: points(lm, LEGACY_PRIMARY_CONTOURS.chin),
    underEyeL: points(lm, LEGACY_PRIMARY_CONTOURS.underEyeL),
    underEyeR: points(lm, LEGACY_PRIMARY_CONTOURS.underEyeR),
    jawL: points(lm, LEGACY_PRIMARY_CONTOURS.jawL),
    jawR: points(lm, LEGACY_PRIMARY_CONTOURS.jawR),
  };

  const regions = {} as Record<RegionKey, Uint8Array>;
  for (const key of ALL_REGION_KEYS) {
    regions[key] = andNot(and(mask(lm, outlines[key]), faceInner), features);
  }

  // Keep regions strictly disjoint with zero pixel overlap:
  // Under-eye bands take precedence over cheeks and nose.
  const underEyes = new Uint8Array(w * h);
  for (let i = 0; i < underEyes.length; i++) underEyes[i] = regions.underEyeL[i] | regions.underEyeR[i];
  regions.cheekL = andNot(regions.cheekL, underEyes);
  regions.cheekR = andNot(regions.cheekR, underEyes);
  regions.nose = andNot(regions.nose, underEyes);

  // Nose takes precedence over medial cheeks
  regions.cheekL = andNot(regions.cheekL, regions.nose);
  regions.cheekR = andNot(regions.cheekR, regions.nose);

  // Chin takes precedence over cheeks if any overlap
  regions.chin = andNot(andNot(regions.chin, regions.cheekL), regions.cheekR);

  // Jawlines take lowest precedence among lower face regions
  for (const jaw of ['jawL', 'jawR'] as const) {
    regions[jaw] = andNot(andNot(andNot(regions[jaw], regions.chin), regions.cheekL), regions.cheekR);
  }

  return { regions, outlines, faceOval, features, eyes, eyeSurround };
}

