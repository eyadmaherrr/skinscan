import type { FaceDetection } from './face-detection';
import { LANDMARK_COUNT, LM } from './face-topology';
import type { RgbImage } from './image/decode';
import { cropAffine, rgbToTensor, warpRgb } from './image/warp';
import { LANDMARK_MIRROR } from './landmark-mirror';
import { runModel } from './models/runtime';

/**
 * Dense face landmarks with MediaPipe Face Mesh V2 (478 3D points).
 * The model expects a 256x256 crop (RGB in [0, 1]) centred on the face,
 * rotated so the eyes are level, with ~25% margin. As in MediaPipe's face
 * landmarker, the first ROI comes from the detector (eye keypoints set the
 * rotation, box scaled 1.5x) and a second, more accurate pass uses an ROI
 * computed from the first pass's landmarks (MediaPipe's "tracking" ROI).
 */

const INPUT = 256;
const ROI_SCALE = 1.5;

export interface FaceLandmarks {
  /** x, y, z triples in source image pixels (z: depth, same scale as x). */
  points: Float32Array;
  /** Face-presence probability reported by the landmark model. */
  presence: number;
}

interface Roi {
  cx: number;
  cy: number;
  size: number;
  rotation: number;
}

function normalizeRadians(angle: number): number {
  return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
}

/** ROI from a detection: rotation from the two eye keypoints, square box scaled 1.5x. */
export function roiFromDetection(d: FaceDetection): Roi {
  const [x0, y0] = d.keypoints[0];
  const [x1, y1] = d.keypoints[1];
  const rotation = normalizeRadians(Math.atan2(y1 - y0, x1 - x0));
  return {
    cx: d.x + d.width / 2,
    cy: d.y + d.height / 2,
    size: Math.max(d.width, d.height) * ROI_SCALE,
    rotation,
  };
}

/** ROI from landmarks: rotation from the outer eye corners, bounding box in the rotated frame, scaled 1.5x. */
export function roiFromLandmarks(points: Float32Array): Roi {
  const x0 = points[LM.eyeOuterImgLeft * 3];
  const y0 = points[LM.eyeOuterImgLeft * 3 + 1];
  const x1 = points[LM.eyeOuterImgRight * 3];
  const y1 = points[LM.eyeOuterImgRight * 3 + 1];
  const rotation = normalizeRadians(Math.atan2(y1 - y0, x1 - x0));
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
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
  const cu = (minU + maxU) / 2;
  const cv = (minV + maxV) / 2;
  return {
    cx: cu * cos - cv * sin,
    cy: cu * sin + cv * cos,
    size: Math.max(maxU - minU, maxV - minV) * ROI_SCALE,
    rotation,
  };
}

/** One model run on a 256×256 crop: landmarks in crop coordinates (x, y, z) and the presence probability. */
async function infer(rgb: Uint8Array): Promise<{ raw: Float32Array; presence: number }> {
  const outputs = await runModel('faceLandmarks', rgbToTensor(rgb, 0, 1), [1, INPUT, INPUT, 3]);
  const tensors = Object.values(outputs);
  const mesh = tensors.find((t) => t.data.length === LANDMARK_COUNT * 3);
  const flag = tensors.find((t) => t.data.length === 1);
  if (!mesh || !flag) throw new Error('unexpected landmark model outputs');
  return { raw: mesh.data as Float32Array, presence: 1 / (1 + Math.exp(-(flag.data as Float32Array)[0])) };
}

function flipHorizontally(rgb: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgb.length);
  for (let y = 0; y < INPUT; y++) {
    for (let x = 0; x < INPUT; x++) {
      const s = (y * INPUT + x) * 3;
      const d = (y * INPUT + (INPUT - 1 - x)) * 3;
      out[d] = rgb[s];
      out[d + 1] = rgb[s + 1];
      out[d + 2] = rgb[s + 2];
    }
  }
  return out;
}

/**
 * Landmarks for one ROI. With `mirrorAverage` (the default) the model also
 * runs on the horizontally flipped crop and the two results are averaged
 * (landmark k of the flipped crop is landmark LANDMARK_MIRROR[k] of the
 * face). The model is not left/right symmetric — on the reference photos it
 * places points 1–2% of the inter-ocular distance apart (up to 6%) between a
 * photo and its mirror image — and averaging removes that part of its error,
 * so the measurement regions land in the same place either way round.
 */
export async function runLandmarks(image: RgbImage, roi: Roi, mirrorAverage = true): Promise<FaceLandmarks> {
  const m = cropAffine(roi.cx, roi.cy, roi.size, roi.size, roi.rotation, INPUT, INPUT);
  const { rgb } = warpRgb(image, INPUT, INPUT, m);
  const direct = await infer(rgb);
  let raw = direct.raw;
  let presence = direct.presence;
  if (mirrorAverage) {
    const flipped = await infer(flipHorizontally(rgb));
    const mean = new Float32Array(LANDMARK_COUNT * 3);
    for (let k = 0; k < LANDMARK_COUNT; k++) {
      const i = LANDMARK_MIRROR[k];
      mean[i * 3] = (direct.raw[i * 3] + (INPUT - flipped.raw[k * 3])) / 2;
      mean[i * 3 + 1] = (direct.raw[i * 3 + 1] + flipped.raw[k * 3 + 1]) / 2;
      mean[i * 3 + 2] = (direct.raw[i * 3 + 2] + flipped.raw[k * 3 + 2]) / 2;
    }
    raw = mean;
    presence = Math.min(direct.presence, flipped.presence);
  }
  const points = new Float32Array(LANDMARK_COUNT * 3);
  const zScale = roi.size / INPUT;
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    const xd = raw[i * 3];
    const yd = raw[i * 3 + 1];
    points[i * 3] = m.a * xd + m.b * yd + m.tx;
    points[i * 3 + 1] = m.c * xd + m.d * yd + m.ty;
    points[i * 3 + 2] = raw[i * 3 + 2] * zScale;
  }
  return { points, presence };
}

export async function detectLandmarks(image: RgbImage, detection: FaceDetection): Promise<FaceLandmarks> {
  const first = await runLandmarks(image, roiFromDetection(detection));
  const refined = await runLandmarks(image, roiFromLandmarks(first.points));
  return refined.presence >= first.presence * 0.8 ? refined : first;
}
