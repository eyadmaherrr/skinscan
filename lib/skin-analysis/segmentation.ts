import type { RgbImage } from './image/decode';
import { cropAffine, invertAffine, rgbToTensor, warpRgb, type Affine } from './image/warp';
import { runModel } from './models/runtime';

/**
 * Per-pixel class probabilities from MediaPipe Selfie Multiclass
 * Segmentation (256x256). Classes: background, hair, body skin, face skin,
 * clothes, others (accessories such as glasses).
 *
 * The model card reports lower mask IoU for the darkest Monk skin tones
 * (68% vs 77% average), so the pipeline never requires the "face skin" class
 * to accept a pixel: landmarks define where skin is expected, and the
 * segmenter is only used to veto pixels it confidently labels as hair,
 * accessories, background or clothing.
 */

const INPUT = 256;
export const SEG_CLASSES = ['background', 'hair', 'bodySkin', 'faceSkin', 'clothes', 'others'] as const;
export type SegClass = (typeof SEG_CLASSES)[number];

export interface Segmentation {
  /** Probability planes (INPUT x INPUT) per class. */
  planes: Record<SegClass, Float32Array>;
  size: number;
  /** Maps source image pixels to segmentation pixels. */
  srcToSeg: Affine;
}

/** Segment a square region of the source image centred on (cx, cy). */
export async function segmentFace(image: RgbImage, cx: number, cy: number, boxSize: number, rotation: number): Promise<Segmentation> {
  const segToSrc = cropAffine(cx, cy, boxSize, boxSize, rotation, INPUT, INPUT);
  const { rgb } = warpRgb(image, INPUT, INPUT, segToSrc);
  const outputs = await runModel('faceSegmenter', rgbToTensor(rgb, 0, 1), [1, INPUT, INPUT, 3]);
  const out = Object.values(outputs)[0];
  const data = out.data as Float32Array;
  const classes = SEG_CLASSES.length;
  if (data.length !== INPUT * INPUT * classes) throw new Error('unexpected segmenter output');

  // Outputs are probabilities; apply a softmax only if they are not already normalised.
  let needsSoftmax = false;
  for (let i = 0; i < 64 && !needsSoftmax; i++) {
    let s = 0;
    for (let c = 0; c < classes; c++) s += data[i * classes + c];
    if (Math.abs(s - 1) > 0.05) needsSoftmax = true;
  }

  const planes = Object.fromEntries(SEG_CLASSES.map((c) => [c, new Float32Array(INPUT * INPUT)])) as Record<
    SegClass,
    Float32Array
  >;
  const values = new Float32Array(classes);
  for (let i = 0; i < INPUT * INPUT; i++) {
    let max = -Infinity;
    for (let c = 0; c < classes; c++) {
      values[c] = data[i * classes + c];
      if (values[c] > max) max = values[c];
    }
    if (needsSoftmax) {
      let sum = 0;
      for (let c = 0; c < classes; c++) {
        values[c] = Math.exp(values[c] - max);
        sum += values[c];
      }
      for (let c = 0; c < classes; c++) values[c] /= sum;
    }
    for (let c = 0; c < classes; c++) planes[SEG_CLASSES[c]][i] = values[c];
  }
  return { planes, size: INPUT, srcToSeg: invertAffine(segToSrc) };
}
