import type { RgbImage } from './image/decode';
import { rgbToTensor, warpRgb, type Affine } from './image/warp';
import { runModel } from './models/runtime';

/**
 * Face detection with MediaPipe BlazeFace (short range).
 * Input 128x128 RGB in [-1, 1]; 896 SSD anchors; 6 keypoints per face.
 * Pre/post-processing mirrors MediaPipe's face_detection_short_range graph:
 * SSD anchors (4 layers, strides 8/16/16/16, fixed anchor size), sigmoid
 * scores, score threshold 0.5 and weighted non-maximum suppression (IoU 0.3).
 */

const INPUT = 128;
const NUM_BOXES = 896;
const NUM_COORDS = 16;
const SCORE_CLIP = 100;
const MIN_SCORE = 0.5;
const NMS_IOU = 0.3;

export interface FaceDetection {
  /** Bounding box in source image pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  /** Keypoints in source pixels: [image-left eye, image-right eye, nose tip, mouth, left tragion, right tragion]. */
  keypoints: [number, number][];
}

let anchorCache: Float32Array | null = null;

/** Anchor centres (x, y) in normalised [0, 1] coordinates. */
function anchors(): Float32Array {
  if (anchorCache) return anchorCache;
  const strides = [8, 16, 16, 16];
  const out: number[] = [];
  let layer = 0;
  while (layer < strides.length) {
    // Layers with the same stride share one feature map; each contributes 2 anchors per cell.
    let anchorsPerCell = 0;
    let last = layer;
    while (last < strides.length && strides[last] === strides[layer]) {
      anchorsPerCell += 2;
      last++;
    }
    const size = Math.ceil(INPUT / strides[layer]);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        for (let k = 0; k < anchorsPerCell; k++) out.push((x + 0.5) / size, (y + 0.5) / size);
      }
    }
    layer = last;
  }
  if (out.length !== NUM_BOXES * 2) throw new Error('unexpected anchor count');
  anchorCache = Float32Array.from(out);
  return anchorCache;
}

interface RawDetection {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  score: number;
  keypoints: number[];
}

function iou(a: RawDetection, b: RawDetection): number {
  const ix = Math.max(0, Math.min(a.xmax, b.xmax) - Math.max(a.xmin, b.xmin));
  const iy = Math.max(0, Math.min(a.ymax, b.ymax) - Math.max(a.ymin, b.ymin));
  const inter = ix * iy;
  const union = (a.xmax - a.xmin) * (a.ymax - a.ymin) + (b.xmax - b.xmin) * (b.ymax - b.ymin) - inter;
  return union > 0 ? inter / union : 0;
}

/** MediaPipe "weighted" NMS: overlapping candidates are averaged, weighted by score. */
function weightedNms(candidates: RawDetection[]): RawDetection[] {
  const remaining = candidates.slice().sort((a, b) => b.score - a.score);
  const result: RawDetection[] = [];
  while (remaining.length) {
    const top = remaining[0];
    const cluster: RawDetection[] = [];
    const rest: RawDetection[] = [];
    for (const c of remaining) (iou(top, c) > NMS_IOU ? cluster : rest).push(c);
    let total = 0;
    const merged: RawDetection = { xmin: 0, ymin: 0, xmax: 0, ymax: 0, score: top.score, keypoints: top.keypoints.map(() => 0) };
    for (const c of cluster) {
      total += c.score;
      merged.xmin += c.xmin * c.score;
      merged.ymin += c.ymin * c.score;
      merged.xmax += c.xmax * c.score;
      merged.ymax += c.ymax * c.score;
      c.keypoints.forEach((v, i) => (merged.keypoints[i] += v * c.score));
    }
    merged.xmin /= total;
    merged.ymin /= total;
    merged.xmax /= total;
    merged.ymax /= total;
    merged.keypoints = merged.keypoints.map((v) => v / total);
    result.push(merged);
    remaining.length = 0;
    remaining.push(...rest);
  }
  return result;
}

/** Detect faces in the whole image (letterboxed to a square). */
export async function detectFaces(image: RgbImage): Promise<FaceDetection[]> {
  const side = Math.max(image.width, image.height);
  const scale = side / INPUT;
  const padX = (side - image.width) / 2;
  const padY = (side - image.height) / 2;
  // dst (0..128) -> src pixels, letterboxed and centred.
  const m: Affine = { a: scale, b: 0, c: 0, d: scale, tx: -padX, ty: -padY };
  const { rgb } = warpRgb(image, INPUT, INPUT, m);
  const outputs = await runModel('faceDetector', rgbToTensor(rgb, -1, 1), [1, INPUT, INPUT, 3]);

  const tensors = Object.values(outputs);
  const regressors = tensors.find((t) => t.dims[t.dims.length - 1] === NUM_COORDS);
  const classifiers = tensors.find((t) => t.dims[t.dims.length - 1] === 1);
  if (!regressors || !classifiers) throw new Error('unexpected face detector outputs');
  const reg = regressors.data as Float32Array;
  const cls = classifiers.data as Float32Array;
  const anc = anchors();

  const candidates: RawDetection[] = [];
  for (let i = 0; i < NUM_BOXES; i++) {
    const logit = Math.max(-SCORE_CLIP, Math.min(SCORE_CLIP, cls[i]));
    const score = 1 / (1 + Math.exp(-logit));
    if (score < MIN_SCORE) continue;
    const o = i * NUM_COORDS;
    const ax = anc[i * 2];
    const ay = anc[i * 2 + 1];
    const cx = reg[o] / INPUT + ax;
    const cy = reg[o + 1] / INPUT + ay;
    const w = reg[o + 2] / INPUT;
    const h = reg[o + 3] / INPUT;
    const keypoints: number[] = [];
    for (let k = 0; k < 6; k++) {
      keypoints.push(reg[o + 4 + k * 2] / INPUT + ax, reg[o + 5 + k * 2] / INPUT + ay);
    }
    candidates.push({ xmin: cx - w / 2, ymin: cy - h / 2, xmax: cx + w / 2, ymax: cy + h / 2, score, keypoints });
  }

  const toSrcX = (v: number) => v * INPUT * scale - padX;
  const toSrcY = (v: number) => v * INPUT * scale - padY;
  return weightedNms(candidates)
    .map((d) => {
      const kp: [number, number][] = [];
      for (let k = 0; k < 6; k++) kp.push([toSrcX(d.keypoints[k * 2]), toSrcY(d.keypoints[k * 2 + 1])]);
      return {
        x: toSrcX(d.xmin),
        y: toSrcY(d.ymin),
        width: (d.xmax - d.xmin) * INPUT * scale,
        height: (d.ymax - d.ymin) * INPUT * scale,
        score: d.score,
        keypoints: kp,
      };
    })
    .sort((a, b) => b.width * b.height - a.width * a.height);
}
