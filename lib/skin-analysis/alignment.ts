import { LANDMARK_COUNT, LM } from './face-topology';
import { rgbToLabImage, type LabImage } from './image/color';
import type { RgbImage } from './image/decode';
import { applyAffine, samplePlane, warpRgb, type Affine } from './image/warp';
import type { AlignedLandmarks } from './regions';
import { segmentFace, type SegClass } from './segmentation';

/**
 * Builds the aligned face crop that every measurement runs on: the face is
 * rotated so the eyes are level and scaled so the inter-ocular distance is at
 * most IOD_MAX pixels (never enlarged). Physical scale is estimated from the
 * inter-ocular distance (adult mean ≈ 63 mm), so filter sizes can be given in
 * millimetres and behave the same for close-up and distant photos.
 */

export const MEAN_IOD_MM = 63;
const IOD_MAX = 420;
const MARGIN_IOD = 0.12;

export interface AlignedFace {
  width: number;
  height: number;
  rgb: Uint8Array;
  /** 1 where the crop pixel lies inside the source photo. */
  valid: Uint8Array;
  lab: LabImage;
  landmarks: AlignedLandmarks;
  /** Landmark depth (crop pixel units). */
  z: Float32Array;
  pxPerMm: number;
  /** Inter-ocular distance in the original photo, in pixels. */
  sourceIod: number;
  cropToSource: Affine;
  /** Segmentation probabilities resampled into the crop. */
  seg: Record<SegClass, Float32Array>;
}

function eyeCentres(points: Float32Array): [[number, number], [number, number]] {
  const c = (a: number, b: number): [number, number] => [
    (points[a * 3] + points[b * 3]) / 2,
    (points[a * 3 + 1] + points[b * 3 + 1]) / 2,
  ];
  return [c(LM.eyeOuterImgLeft, LM.eyeInnerImgLeft), c(LM.eyeOuterImgRight, LM.eyeInnerImgRight)];
}

export function sourceIod(points: Float32Array): number {
  const [l, r] = eyeCentres(points);
  return Math.hypot(r[0] - l[0], r[1] - l[1]);
}

export async function alignFace(image: RgbImage, points: Float32Array): Promise<AlignedFace> {
  const [eyeL, eyeR] = eyeCentres(points);
  const theta = Math.atan2(eyeR[1] - eyeL[1], eyeR[0] - eyeL[0]);
  const iodSrc = Math.hypot(eyeR[0] - eyeL[0], eyeR[1] - eyeL[1]);
  const s = Math.min(1, IOD_MAX / iodSrc);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const u = x * cos + y * sin;
    const v = -x * sin + y * cos;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const iod = iodSrc * s;
  const margin = Math.round(iod * MARGIN_IOD);
  const width = Math.ceil((maxU - minU) * s) + 2 * margin;
  const height = Math.ceil((maxV - minV) * s) + 2 * margin;
  const u0 = minU - margin / s;
  const v0 = minV - margin / s;
  const cropToSource: Affine = {
    a: cos / s,
    b: -sin / s,
    c: sin / s,
    d: cos / s,
    tx: cos * u0 - sin * v0,
    ty: sin * u0 + cos * v0,
  };

  const xy = new Float32Array(LANDMARK_COUNT * 2);
  const z = new Float32Array(LANDMARK_COUNT);
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    xy[i * 2] = (x * cos + y * sin - u0) * s;
    xy[i * 2 + 1] = (-x * sin + y * cos - v0) * s;
    z[i] = points[i * 3 + 2] * s;
  }

  const { rgb, valid } = warpRgb(image, width, height, cropToSource);
  const lab = rgbToLabImage(rgb, width * height);

  // Segment a square around the face (in the same eye-level orientation), then resample into the crop.
  const faceCx = ((minU + maxU) / 2) * cos - ((minV + maxV) / 2) * sin;
  const faceCy = ((minU + maxU) / 2) * sin + ((minV + maxV) / 2) * cos;
  const segBox = Math.max(maxU - minU, maxV - minV) * 1.5;
  const segmentation = await segmentFace(image, faceCx, faceCy, segBox, theta);
  const seg = {} as Record<SegClass, Float32Array>;
  for (const key of Object.keys(segmentation.planes) as SegClass[]) seg[key] = new Float32Array(width * height);
  const keys = Object.keys(seg) as SegClass[];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [xs, ys] = applyAffine(cropToSource, x + 0.5, y + 0.5);
      const [xg, yg] = applyAffine(segmentation.srcToSeg, xs, ys);
      const i = y * width + x;
      for (const key of keys) seg[key][i] = samplePlane(segmentation.planes[key], segmentation.size, segmentation.size, xg, yg);
    }
  }

  return {
    width,
    height,
    rgb,
    valid,
    lab,
    landmarks: { xy, width, height, iod },
    z,
    pxPerMm: iod / MEAN_IOD_MM,
    sourceIod: iodSrc,
    cropToSource,
    seg,
  };
}
