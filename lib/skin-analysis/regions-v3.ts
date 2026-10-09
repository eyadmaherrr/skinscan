import { dilate, erode } from './image/filters';
import { and, andNot, fillPolygon, type Point } from './geometry';
import {
  ANATOMICAL_CONTOURS_V3,
  BROW_LOWER_IMG_LEFT,
  BROW_LOWER_IMG_RIGHT,
  BROW_UPPER_IMG_LEFT,
  BROW_UPPER_IMG_RIGHT,
  EYE_IMG_LEFT,
  EYE_IMG_RIGHT,
  FACE_OVAL,
  LIPS_OUTER,
} from './face-topology';

import {
  ANATOMICAL_REGION_KEYS_V3,
  ANATOMICAL_REGION_NAMES,
  type RegionKeyV3,
  type RegionStatusV3,
  type RegionUnavailableReason,
} from './types-v3';
import type { AlignedLandmarks } from './regions';
import type { AlignedFace } from './alignment';
import { applyAffine } from './image/warp';

export interface AnatomicalRegionV3 {
  key: RegionKeyV3;
  nameEn: string;
  nameAr: string;
  /** Binary mask in aligned face crop dimensions (w × h). */
  mask: Uint8Array;
  /** Outline points in crop coordinates. */
  outlineCrop: Point[];
  /** Outline points normalized to 0–1 in source photo space. */
  outlineSource: [number, number][];
  pixelCount: number;
  usableSkinPixels: number;
  skinCoverage: number;
  areaMm2: number;
  status: RegionStatusV3;
  unavailableReasons: RegionUnavailableReason[];
}

export interface AnatomicalFacialRegionsV3 {
  regions: Record<RegionKeyV3, AnatomicalRegionV3>;
  faceOval: Uint8Array;
  features: Uint8Array;
  eyes: Uint8Array;
  eyeSurround: Uint8Array;
  usableSkin: Uint8Array;
  totalSkinPixels: number;
}

function point(lm: AlignedLandmarks, index: number): Point {
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


/**
 * Builds the complete 24 anatomical facial regions from 3D landmarks and segmentation vetoes.
 * Enforces strict boundary geometry, zero double-counting, and seamless anatomical transitions.
 */
export function buildAnatomicalRegionsV3(
  lm: AlignedLandmarks,
  face: Pick<AlignedFace, 'pxPerMm' | 'cropToSource' | 'seg'>,
  sourceWidth: number,
  sourceHeight: number,
): AnatomicalFacialRegionsV3 {
  const { width: w, height: h, iod } = lm;
  const px = (f: number) => f * iod;

  // 1. Face Oval & Inner Bounds
  const faceOvalPoly = points(lm, FACE_OVAL);
  const faceOval = mask(lm, faceOvalPoly);
  const faceInner = erode(faceOval, w, h, Math.max(1, Math.round(px(0.03))));

  // 2. Anatomical Exclusions (Never analysed as skin)
  const eyes = new Uint8Array(w * h);
  fillPolygon(eyes, w, h, points(lm, EYE_IMG_LEFT));
  fillPolygon(eyes, w, h, points(lm, EYE_IMG_RIGHT));

  const brows = new Uint8Array(w * h);
  fillPolygon(brows, w, h, [...points(lm, BROW_UPPER_IMG_LEFT), ...points(lm, BROW_LOWER_IMG_LEFT).reverse()]);
  fillPolygon(brows, w, h, [...points(lm, BROW_UPPER_IMG_RIGHT), ...points(lm, BROW_LOWER_IMG_RIGHT).reverse()]);

  const lips = mask(lm, points(lm, LIPS_OUTER));

  const eyesDilated = dilate(eyes, w, h, Math.max(1, Math.round(px(0.06))));
  const browsDilated = dilate(brows, w, h, Math.max(1, Math.round(px(0.05))));
  const lipsDilated = dilate(lips, w, h, Math.max(1, Math.round(px(0.04))));

  const features = new Uint8Array(w * h);
  for (let i = 0; i < features.length; i++) {
    features[i] = eyesDilated[i] | browsDilated[i] | lipsDilated[i];
  }
  const eyeSurround = andNot(dilate(eyes, w, h, Math.max(1, Math.round(px(0.22)))), brows);

  // 3. Anatomical Outlines (Built directly from canonical MediaPipe landmark contours)
  const rawOutlines = {} as Record<RegionKeyV3, Point[]>;
  for (const key of ANATOMICAL_REGION_KEYS_V3) {
    rawOutlines[key] = points(lm, ANATOMICAL_CONTOURS_V3[key]);
  }


  // -------------------------------------------------------------------------
  // 4. Initial Rasterization & Mutual Exclusivity (Zero Overlap)
  // -------------------------------------------------------------------------
  const rawMasks = {} as Record<RegionKeyV3, Uint8Array>;
  for (const key of ANATOMICAL_REGION_KEYS_V3) {
    rawMasks[key] = andNot(and(mask(lm, rawOutlines[key]), faceInner), features);
  }

  // Precedence order for strict pairwise mutual exclusivity (zero overlap across all regions):
  // Specialized focal structures take precedence over general expanses.
  const DISJOINT_PRECEDENCE: RegionKeyV3[] = [
    // 1. Periocular & Glabella
    'upperEyeLeft',
    'upperEyeRight',
    'underEyeLeft',
    'underEyeRight',
    'glabella',
    // 2. Nose
    'noseTip',
    'alarSkinLeft',
    'alarSkinRight',
    'nasalSidewallLeft',
    'nasalSidewallRight',
    'noseBridge',
    // 3. Perioral
    'perioralUpper',
    'perioralLower',
    'perioralLeft',
    'perioralRight',
    // 4. Chin
    'chinCenter',
    'chinLeft',
    'chinRight',
    // 5. Forehead & Temples
    'templeLeft',
    'templeRight',
    'foreheadCenter',
    'foreheadLeft',
    'foreheadRight',
    // 6. Cheeks
    'cheekLeft',
    'cheekRight',
    // 7. Jawline
    'jawlineLeft',
    'jawlineRight',
  ];

  const claimed = new Uint8Array(w * h);
  for (const key of DISJOINT_PRECEDENCE) {
    rawMasks[key] = andNot(rawMasks[key], claimed);
    for (let i = 0; i < w * h; i++) {
      if (rawMasks[key][i]) claimed[i] = 1;
    }
  }

  // -------------------------------------------------------------------------
  // 5. Segmentation Veto & Usable Skin Computation
  // -------------------------------------------------------------------------
  const seg = face.seg;
  const isVetoed = (i: number) =>
    seg.hair[i] >= 0.5 ||
    seg.others[i] >= 0.4 ||
    seg.background[i] >= 0.6 ||
    seg.clothes[i] >= 0.5;

  const usableSkin = new Uint8Array(w * h);
  let totalSkinPixels = 0;
  for (let i = 0; i < usableSkin.length; i++) {
    if (faceInner[i] && !features[i] && !isVetoed(i)) {
      usableSkin[i] = 1;
      totalSkinPixels++;
    }
  }

  // 6. Build Final AnatomicalRegionV3 Record
  const regions = {} as Record<RegionKeyV3, AnatomicalRegionV3>;
  const pxMm = face.pxPerMm;

  for (const key of ANATOMICAL_REGION_KEYS_V3) {
    const rMask = rawMasks[key];
    let pixelCount = 0;
    let usableSkinPixels = 0;
    for (let i = 0; i < rMask.length; i++) {
      if (rMask[i]) {
        pixelCount++;
        if (usableSkin[i]) usableSkinPixels++;
      }
    }

    const skinCoverage = pixelCount > 0 ? usableSkinPixels / pixelCount : 0;
    const areaMm2 = pxMm > 0 ? usableSkinPixels / (pxMm * pxMm) : 0;

    // Source photo normalized outline
    const outlineCrop = rawOutlines[key];
    const outlineSource: [number, number][] = outlineCrop.map(([x, y]) => {
      const [xs, ys] = applyAffine(face.cropToSource, x, y);
      return [
        Math.round((xs / sourceWidth) * 10000) / 10000,
        Math.round((ys / sourceHeight) * 10000) / 10000,
      ];
    });

    const unavailableReasons: RegionUnavailableReason[] = [];
    let status: RegionStatusV3 = 'usable';

    if (pixelCount === 0 || usableSkinPixels < 50) {
      status = 'unavailable';
      unavailableReasons.push('insufficient_skin');
    } else if (skinCoverage < 0.35) {
      status = 'occluded';
      unavailableReasons.push('occluded_by_hair');
    } else if (skinCoverage < 0.6) {
      status = 'low_quality';
    }

    regions[key] = {
      key,
      nameEn: ANATOMICAL_REGION_NAMES[key].en,
      nameAr: ANATOMICAL_REGION_NAMES[key].ar,
      mask: rMask,
      outlineCrop,
      outlineSource,
      pixelCount,
      usableSkinPixels,
      skinCoverage,
      areaMm2: Math.round(areaMm2 * 10) / 10,
      status,
      unavailableReasons,
    };
  }

  return {
    regions,
    faceOval,
    features,
    eyes,
    eyeSurround,
    usableSkin,
    totalSkinPixels,
  };
}

/**
 * Backward compatibility helper: maps 24 anatomical v3 regions into
 * legacy 9 face regions expected by existing tests and components.
 */
export function buildLegacyRegionsFromV3(
  lm: AlignedLandmarks,
  v3: AnatomicalFacialRegionsV3,
): Record<string, Uint8Array> {
  const { width: w, height: h } = lm;
  const legacy: Record<string, Uint8Array> = {
    forehead: new Uint8Array(w * h),
    nose: new Uint8Array(w * h),
    cheekL: new Uint8Array(w * h),
    cheekR: new Uint8Array(w * h),
    chin: new Uint8Array(w * h),
    underEyeL: new Uint8Array(w * h),
    underEyeR: new Uint8Array(w * h),
    jawL: new Uint8Array(w * h),
    jawR: new Uint8Array(w * h),
  };

  const add = (target: Uint8Array, source: Uint8Array) => {
    for (let i = 0; i < target.length; i++) target[i] |= source[i];
  };

  add(legacy.forehead, v3.regions.foreheadCenter.mask);
  add(legacy.forehead, v3.regions.foreheadLeft.mask);
  add(legacy.forehead, v3.regions.foreheadRight.mask);
  add(legacy.forehead, v3.regions.glabella.mask);

  add(legacy.nose, v3.regions.noseBridge.mask);
  add(legacy.nose, v3.regions.noseTip.mask);
  add(legacy.nose, v3.regions.nasalSidewallLeft.mask);
  add(legacy.nose, v3.regions.nasalSidewallRight.mask);
  add(legacy.nose, v3.regions.alarSkinLeft.mask);
  add(legacy.nose, v3.regions.alarSkinRight.mask);

  add(legacy.cheekL, v3.regions.cheekLeft.mask);
  add(legacy.cheekL, v3.regions.templeLeft.mask);

  add(legacy.cheekR, v3.regions.cheekRight.mask);
  add(legacy.cheekR, v3.regions.templeRight.mask);

  add(legacy.chin, v3.regions.chinCenter.mask);
  add(legacy.chin, v3.regions.chinLeft.mask);
  add(legacy.chin, v3.regions.chinRight.mask);

  add(legacy.underEyeL, v3.regions.underEyeLeft.mask);
  add(legacy.underEyeR, v3.regions.underEyeRight.mask);

  add(legacy.jawL, v3.regions.jawlineLeft.mask);
  add(legacy.jawR, v3.regions.jawlineRight.mask);

  return legacy;
}
