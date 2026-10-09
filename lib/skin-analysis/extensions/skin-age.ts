import { access } from 'node:fs/promises';
import path from 'node:path';
import { serverConfig } from '../../config';
import type { AlignedFace } from '../alignment';
import type { RgbImage } from '../image/decode';
import { cropAffine, warpRgb, type Affine } from '../image/warp';
import { runModel } from '../models/runtime';
import { analysisText } from '../text';
import { AGE_RANGES, type AgeRange, type SkinAgeReport } from '../types';
import type { Locale } from '../../i18n';

/**
 * Skin age (apparent age) estimate.
 *
 * Model: Hugging Face `dima806/fairface_age_image_detection` (ViT-B/16 from
 * google/vit-base-patch16-224-in21k, Apache-2.0), fine-tuned on the FairFace
 * dataset (Kärkkäinen & Joo, WACV 2021; CC BY 4.0), whose age labels are the
 * age range people *guess* from the photo, balanced across seven ethnic
 * groups. ONNX int8 export by onnx-community. It classifies a face into nine
 * age ranges; its published accuracy on 10,000 FairFace test faces is 59%
 * (adult ranges 46–68% recall), so the result is shown as a range with the
 * model's probability, never as an exact age.
 *
 * Input: a FairFace-style face chip — dlib's get_face_chip layout with
 * padding 0.25 (the setting FairFace was built with), rebuilt here from the
 * MediaPipe landmarks — 224×224 RGB, normalised to [-1, 1].
 *
 * It is an estimate of how old the face looks in this photo (skin, but also
 * features such as facial hair and hairline), not a biological measurement.
 */

const INPUT = 224;
/** Year span of each class, in the model's output order. */
const SPANS: Record<AgeRange, [number, number | null]> = {
  '0-2': [0, 2],
  '3-9': [3, 9],
  '10-19': [10, 19],
  '20-29': [20, 29],
  '30-39': [30, 39],
  '40-49': [40, 49],
  '50-59': [50, 59],
  '60-69': [60, 69],
  '70+': [70, null],
};
/** A single range is shown when it holds at least this probability; otherwise it is joined with its likelier neighbour. */
const SINGLE_RANGE = 0.6;

// MediaPipe landmark indices: outer brow ends, upper brow contour, lower-lip bottom.
const BROW_OUTER_LEFT = [46, 70];
const BROW_OUTER_RIGHT = [276, 300];
const BROW_UPPER = [70, 63, 105, 66, 107, 336, 296, 334, 293, 300];
const LOWER_LIP_BOTTOM = 17;

/** Composition: first `inner`, then `outer`. */
function compose(outer: Affine, inner: Affine): Affine {
  return {
    a: outer.a * inner.a + outer.b * inner.c,
    b: outer.a * inner.b + outer.b * inner.d,
    c: outer.c * inner.a + outer.d * inner.c,
    d: outer.c * inner.b + outer.d * inner.d,
    tx: outer.a * inner.tx + outer.b * inner.ty + outer.tx,
    ty: outer.c * inner.tx + outer.d * inner.ty + outer.ty,
  };
}

/**
 * The face chip box in aligned-crop coordinates. dlib's template spans
 * brow-end to brow-end (0–0.98) horizontally and brow-top to lower lip
 * (0.019–0.909) vertically in unit coordinates; padding 0.25 extends the
 * unit square by a quarter on every side.
 */
export function faceChipBox(face: AlignedFace): { cx: number; cy: number; side: number } {
  const { xy } = face.landmarks;
  const x = (i: number) => xy[i * 2];
  const y = (i: number) => xy[i * 2 + 1];
  const x0 = Math.min(...BROW_OUTER_LEFT.map(x));
  const x1 = Math.max(...BROW_OUTER_RIGHT.map(x));
  const top = Math.min(...BROW_UPPER.map(y));
  const lip = y(LOWER_LIP_BOTTOM);
  const unit = ((x1 - x0) / 0.98 + (lip - top) / 0.89) / 2;
  const originY = top - 0.019 * unit;
  return { cx: x0 + 0.5 * unit, cy: originY + 0.5 * unit, side: 1.5 * unit };
}

/** 224×224 face chip from the original photo, as an NCHW tensor in [-1, 1]. */
export function faceChipTensor(face: AlignedFace, image: RgbImage): Float32Array {
  const { cx, cy, side } = faceChipBox(face);
  const chipToSource = compose(face.cropToSource, cropAffine(cx, cy, side, side, 0, INPUT, INPUT));
  const { rgb } = warpRgb(image, INPUT, INPUT, chipToSource);
  const plane = INPUT * INPUT;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    out[i] = rgb[i * 3] / 127.5 - 1;
    out[plane + i] = rgb[i * 3 + 1] / 127.5 - 1;
    out[2 * plane + i] = rgb[i * 3 + 2] / 127.5 - 1;
  }
  return out;
}

export function softmax(logits: ArrayLike<number>): number[] {
  const max = Math.max(...Array.from(logits));
  const e = Array.from(logits, (v) => Math.exp(v - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}

/**
 * The range shown to the user: the most likely class, joined with its more
 * likely neighbour when it holds less than 60% of the probability.
 */
export function likelySpan(probabilities: number[]): { lo: number; hi: number; probability: number } {
  let best = 0;
  for (let i = 1; i < probabilities.length; i++) if (probabilities[i] > probabilities[best]) best = i;
  let lo = best;
  let hi = best;
  let p = probabilities[best];
  if (p < SINGLE_RANGE) {
    const below = best > 0 ? probabilities[best - 1] : -1;
    const above = best < probabilities.length - 1 ? probabilities[best + 1] : -1;
    if (above >= below) hi++;
    else lo--;
    p += Math.max(below, above);
  }
  return { lo, hi, probability: p };
}

export function skinAgeModelFile(): string {
  return path.join(serverConfig.modelDir, 'skin_age.onnx');
}

function unavailable(status: SkinAgeReport['status'], locale?: Locale): SkinAgeReport {
  const text = analysisText(locale).skinAge;
  return {
    status,
    minYears: null,
    maxYears: null,
    probability: null,
    probabilities: null,
    explanation: status === 'disabled' ? text.disabled : status === 'not_configured' ? text.notConfigured : text.failed,
    limitations: [],
  };
}

export async function estimateSkinAge(
  face: AlignedFace,
  image: RgbImage,
  options: { enabled: boolean; locale?: Locale },
): Promise<SkinAgeReport> {
  if (!options.enabled) return unavailable('disabled', options.locale);
  try {
    await access(skinAgeModelFile());
  } catch {
    // The model is downloaded at build time (scripts/fetch-models.mjs); without it the estimate is skipped.
    return unavailable('not_configured', options.locale);
  }
  const outputs = await runModel('skinAge', faceChipTensor(face, image), [1, 3, INPUT, INPUT]);
  const logits = Object.values(outputs)[0]?.data as Float32Array | undefined;
  if (!logits || logits.length !== AGE_RANGES.length || !Array.from(logits).every(Number.isFinite)) {
    throw new Error('unexpected skin-age model output');
  }
  const probs = softmax(logits);
  const span = likelySpan(probs);
  const [minYears] = SPANS[AGE_RANGES[span.lo]];
  const [, maxYears] = SPANS[AGE_RANGES[span.hi]];
  const text = analysisText(options.locale).skinAge;
  return {
    status: 'ok',
    minYears,
    maxYears,
    probability: Math.round(span.probability * 100) / 100,
    probabilities: Object.fromEntries(AGE_RANGES.map((r, i) => [r, Math.round(probs[i] * 1000) / 1000])) as Record<AgeRange, number>,
    explanation: text.summary(minYears, maxYears, Math.round(span.probability * 100)),
    limitations: text.limitations,
  };
}
