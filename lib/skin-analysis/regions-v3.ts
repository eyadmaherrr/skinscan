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

  // 3. Topology Reference Anchors
  const midTop = point(lm, LM.noseBridge);
  const tip = point(lm, LM.noseTip);
  const infratip = point(lm, LM.infratip);
  const subnasale = point(lm, LM.subnasale);
  const chinPt = point(lm, LM.chin);
  const lowerLipBottom = point(lm, LM.lowerLipBottom);
  const upperLipTop = point(lm, LM.upperLipTop);

  const eyeL = eyeCentre(lm, LM.eyeOuterImgLeft, LM.eyeInnerImgLeft);
  const eyeR = eyeCentre(lm, LM.eyeOuterImgRight, LM.eyeInnerImgRight);
  const eyeY = (eyeL[1] + eyeR[1]) / 2;

  const mouthL = point(lm, LM.mouthCornerImgLeft);
  const mouthR = point(lm, LM.mouthCornerImgRight);
  const sideL = point(lm, LM.faceSideImgLeft);
  const sideR = point(lm, LM.faceSideImgRight);

  const leftBrowInner = point(lm, LM.leftBrowInner);
  const rightBrowInner = point(lm, LM.rightBrowInner);
  const leftBrowOuter = point(lm, LM.leftBrowOuter);
  const rightBrowOuter = point(lm, LM.rightBrowOuter);

  const midXAt = (y: number) => {
    const t = (y - midTop[1]) / Math.max(1, tip[1] - midTop[1]);
    return lerp(midTop[0], tip[0], Math.max(0, Math.min(1.2, t)));
  };

  const rawOutlines = {} as Record<RegionKeyV3, Point[]>;

  // -------------------------------------------------------------------------
  // A. Forehead, Temples & Glabella
  // -------------------------------------------------------------------------
  const browRaise = px(0.06);
  const foreheadArc = points(lm, FOREHEAD_ARC); // Left -> Right (54 ... 284)
  const arcMid = Math.floor(foreheadArc.length / 2);
  const arcLeftThird = Math.floor(foreheadArc.length / 3);
  const arcRightThird = Math.floor((2 * foreheadArc.length) / 3);

  // Glabella: between the eyebrows above the nasion
  const glabellaTop = (leftBrowInner[1] + rightBrowInner[1]) / 2 - browRaise * 0.4;
  const glabellaBottom = midTop[1];
  rawOutlines.glabella = [
    [leftBrowInner[0] + px(0.02), glabellaTop],
    [rightBrowInner[0] - px(0.02), glabellaTop],
    [rightBrowInner[0] - px(0.01), glabellaBottom],
    [leftBrowInner[0] + px(0.01), glabellaBottom],
  ];

  // Forehead Center
  rawOutlines.foreheadCenter = [
    ...foreheadArc.slice(arcLeftThird, arcRightThird + 1),
    [rightBrowInner[0] - px(0.02), glabellaTop],
    [leftBrowInner[0] + px(0.02), glabellaTop],
  ];

  // Forehead Left
  rawOutlines.foreheadLeft = [
    ...foreheadArc.slice(0, arcLeftThird + 1),
    [leftBrowInner[0] + px(0.02), glabellaTop],
    ...shift(points(lm, BROW_UPPER_IMG_LEFT), 0, -browRaise),
  ];

  // Forehead Right
  rawOutlines.foreheadRight = [
    ...shift(points(lm, BROW_UPPER_IMG_RIGHT), 0, -browRaise).reverse(),
    [rightBrowInner[0] - px(0.02), glabellaTop],
    ...foreheadArc.slice(arcRightThird),
  ];

  // Temples
  rawOutlines.templeLeft = [
    foreheadArc[0],
    [leftBrowOuter[0] - px(0.08), leftBrowOuter[1] - px(0.04)],
    [sideL[0], leftBrowOuter[1] + px(0.12)],
    [sideL[0] - px(0.06), foreheadArc[0][1]],
  ];

  rawOutlines.templeRight = [
    [sideR[0] + px(0.06), foreheadArc[foreheadArc.length - 1][1]],
    [sideR[0], rightBrowOuter[1] + px(0.12)],
    [rightBrowOuter[0] + px(0.08), rightBrowOuter[1] - px(0.04)],
    foreheadArc[foreheadArc.length - 1],
  ];

  // -------------------------------------------------------------------------
  // B. Periocular (Upper Eyelids and Under-Eyes)
  // -------------------------------------------------------------------------
  const lidL = points(lm, LOWER_LID_IMG_LEFT).slice(0, -1);
  const lidR = points(lm, LOWER_LID_IMG_RIGHT).slice(0, -1);
  const browLowL = points(lm, BROW_LOWER_IMG_LEFT);
  const browLowR = points(lm, BROW_LOWER_IMG_RIGHT);

  // Upper Eyelid skin
  rawOutlines.upperEyeLeft = [
    ...shift(browLowL, 0, px(0.03)),
    ...shift(points(lm, EYE_IMG_LEFT).slice(9), 0, -px(0.02)).reverse(),
  ];

  rawOutlines.upperEyeRight = [
    ...shift(browLowR, 0, px(0.03)),
    ...shift(points(lm, EYE_IMG_RIGHT).slice(9), 0, -px(0.02)).reverse(),
  ];

  // Under-Eye skin (follows lower eyelid curve down into tear trough)
  rawOutlines.underEyeLeft = [
    ...shift(lidL, 0, px(0.05)),
    ...shift(lidL, 0, px(0.25)).reverse(),
  ];

  rawOutlines.underEyeRight = [
    ...shift(lidR, 0, px(0.05)),
    ...shift(lidR, 0, px(0.25)).reverse(),
  ];

  // -------------------------------------------------------------------------
  // C. Nose (Bridge, Tip, Sidewalls, and Alar Skin)
  // -------------------------------------------------------------------------
  const noseTopY = glabellaBottom;
  const noseMidY = eyeY + px(0.22);
  const noseTipBottomY = infratip[1] + px(0.02);

  // Nose Bridge
  rawOutlines.noseBridge = [
    [midXAt(noseTopY) - px(0.08), noseTopY],
    [midXAt(noseTopY) + px(0.08), noseTopY],
    [midXAt(noseMidY) + px(0.09), noseMidY],
    [midXAt(noseMidY) - px(0.09), noseMidY],
  ];

  // Nose Tip
  rawOutlines.noseTip = [
    [midXAt(noseMidY) - px(0.12), noseMidY],
    [midXAt(noseMidY) + px(0.12), noseMidY],
    [midXAt(noseTipBottomY) + px(0.14), noseTipBottomY],
    [midXAt(noseTipBottomY) - px(0.14), noseTipBottomY],
  ];

  // Nasal Sidewalls
  rawOutlines.nasalSidewallLeft = [
    [midXAt(noseTopY) - px(0.08), noseTopY],
    [midXAt(noseMidY) - px(0.09), noseMidY],
    [midXAt(noseMidY) - px(0.20), noseMidY + px(0.04)],
    [midXAt(noseTopY) - px(0.18), noseTopY],
  ];

  rawOutlines.nasalSidewallRight = [
    [midXAt(noseTopY) + px(0.08), noseTopY],
    [midXAt(noseTopY) + px(0.18), noseTopY],
    [midXAt(noseMidY) + px(0.20), noseMidY + px(0.04)],
    [midXAt(noseMidY) + px(0.09), noseMidY],
  ];

  // Alar Skin
  const alarBottomY = subnasale[1];
  rawOutlines.alarSkinLeft = [
    [midXAt(noseMidY) - px(0.20), noseMidY + px(0.04)],
    [midXAt(noseTipBottomY) - px(0.14), noseTipBottomY],
    [midXAt(alarBottomY) - px(0.10), alarBottomY],
    [midXAt(alarBottomY) - px(0.26), alarBottomY],
  ];

  rawOutlines.alarSkinRight = [
    [midXAt(noseTipBottomY) + px(0.14), noseTipBottomY],
    [midXAt(noseMidY) + px(0.20), noseMidY + px(0.04)],
    [midXAt(alarBottomY) + px(0.26), alarBottomY],
    [midXAt(alarBottomY) + px(0.10), alarBottomY],
  ];

  // -------------------------------------------------------------------------
  // D. Perioral (Upper/Philtrum, Lower, Left, Right)
  // -------------------------------------------------------------------------
  const philtrumTop = subnasale[1];
  const upperLipY = upperLipTop[1];
  rawOutlines.perioralUpper = [
    [midXAt(philtrumTop) - px(0.14), philtrumTop],
    [midXAt(philtrumTop) + px(0.14), philtrumTop],
    [mouthR[0] - px(0.06), upperLipY],
    [mouthL[0] + px(0.06), upperLipY],
  ];

  const lowerLipY = lowerLipBottom[1];
  const labiomentalY = point(lm, LM.labiomentalCrease)[1] || (lowerLipY + px(0.14));
  rawOutlines.perioralLower = [
    [mouthL[0] + px(0.05), lowerLipY],
    [mouthR[0] - px(0.05), lowerLipY],
    [mouthR[0] - px(0.08), labiomentalY],
    [mouthL[0] + px(0.08), labiomentalY],
  ];

  rawOutlines.perioralLeft = [
    [mouthL[0] - px(0.18), upperLipY - px(0.06)],
    [mouthL[0] + px(0.02), upperLipY],
    [mouthL[0] + px(0.02), lowerLipY],
    [mouthL[0] - px(0.18), lowerLipY + px(0.06)],
  ];

  rawOutlines.perioralRight = [
    [mouthR[0] - px(0.02), upperLipY],
    [mouthR[0] + px(0.18), upperLipY - px(0.06)],
    [mouthR[0] + px(0.18), lowerLipY + px(0.06)],
    [mouthR[0] - px(0.02), lowerLipY],
  ];

  // -------------------------------------------------------------------------
  // E. Chin (Center, Left, Right)
  // -------------------------------------------------------------------------
  const chinBottomY = chinPt[1] - px(0.03);
  const chinCenterX0 = midXAt(labiomentalY) - px(0.14);
  const chinCenterX1 = midXAt(labiomentalY) + px(0.14);

  rawOutlines.chinCenter = [
    [chinCenterX0, labiomentalY],
    [chinCenterX1, labiomentalY],
    [chinCenterX1 - px(0.04), chinBottomY],
    [chinCenterX0 + px(0.04), chinBottomY],
  ];

  rawOutlines.chinLeft = [
    [mouthL[0] + px(0.02), labiomentalY],
    [chinCenterX0, labiomentalY],
    [chinCenterX0 + px(0.04), chinBottomY],
    [mouthL[0] - px(0.04), chinBottomY],
  ];

  rawOutlines.chinRight = [
    [chinCenterX1, labiomentalY],
    [mouthR[0] - px(0.02), labiomentalY],
    [mouthR[0] + px(0.04), chinBottomY],
    [chinCenterX1 - px(0.04), chinBottomY],
  ];

  // -------------------------------------------------------------------------
  // F. Cheeks (Left and Right)
  // -------------------------------------------------------------------------
  const lidBottomL = Math.max(...lidL.map((p) => p[1]));
  const lidBottomR = Math.max(...lidR.map((p) => p[1]));
  const cheekTopL = lidBottomL + px(0.08);
  const cheekTopR = lidBottomR + px(0.08);
  const cheekBottomL = mouthL[1];
  const cheekBottomR = mouthR[1];

  rawOutlines.cheekLeft = [
    [sideL[0] - px(0.08), cheekTopL],
    [midXAt(cheekTopL) - px(0.18), cheekTopL],
    [mouthL[0] - px(0.06), cheekBottomL],
    [sideL[0] - px(0.08), cheekBottomL],
  ];

  rawOutlines.cheekRight = [
    [midXAt(cheekTopR) + px(0.18), cheekTopR],
    [sideR[0] + px(0.08), cheekTopR],
    [sideR[0] + px(0.08), cheekBottomR],
    [mouthR[0] + px(0.06), cheekBottomR],
  ];

  // -------------------------------------------------------------------------
  // G. Jawline (Left and Right)
  // -------------------------------------------------------------------------
  const jawTop = Math.max(mouthL[1], mouthR[1]) + px(0.06);
  rawOutlines.jawlineLeft = [
    [sideL[0] - px(0.15), jawTop],
    [mouthL[0] - px(0.08), jawTop],
    [mouthL[0] - px(0.02), chinPt[1]],
    [sideL[0] - px(0.15), chinPt[1]],
  ];

  rawOutlines.jawlineRight = [
    [mouthR[0] + px(0.08), jawTop],
    [sideR[0] + px(0.15), jawTop],
    [sideR[0] + px(0.15), chinPt[1]],
    [mouthR[0] + px(0.02), chinPt[1]],
  ];

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
