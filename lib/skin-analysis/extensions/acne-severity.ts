import { readFile } from 'node:fs/promises';
import type { AlignedFace } from '../alignment';
import { cropAffine, rgbToTensor, warpRgb } from '../image/warp';
import { getOptionalSession, runSession } from '../models/runtime';
import type { AcneSeverity } from '../types';

/**
 * Optional whole-face acne-severity classifier (experimental).
 *
 * Model: Hugging Face `afscomercial/dermatologic` — torchvision ResNet-50,
 * 4 classes `level0`–`level3`, converted to ONNX by
 * scripts/convert/convert_acne_classifier.py (BN folded, ImageNet
 * normalisation inside the graph; input 224x224 RGB in [0, 1]).
 *
 * It returns one label for the whole image. It does NOT detect, count or
 * type individual lesions. Its training data is not documented by the
 * publisher and its labels match ACNE04 (non-commercial terms), so it is
 * disabled unless SKINSCAN_ACNE_SEVERITY_MODEL points to the converted file.
 */

export const ACNE_SEVERITY_SCALE =
  "Experimental classifier with the publisher's four classes: level0 (no or minimal acne), level1 (mild), level2 (moderate), level3 (severe). Not a clinical grade and not validated on SkinScan photos.";

const INPUT = 224;
const LABELS = ['level0', 'level1', 'level2', 'level3'];

export function disabledSeverity(status: AcneSeverity['status'] = 'disabled'): AcneSeverity {
  return { status, label: null, scale: status === 'disabled' ? null : ACNE_SEVERITY_SCALE, probabilities: null };
}

/** Square crop around the aligned face (eyes level), resized to 224×224. */
export function faceSquareTensor(face: AlignedFace): Float32Array {
  const side = Math.max(face.width, face.height);
  const m = cropAffine(face.width / 2, face.height / 2, side, side, 0, INPUT, INPUT);
  const { rgb } = warpRgb({ data: face.rgb, width: face.width, height: face.height }, INPUT, INPUT, m);
  return rgbToTensor(rgb, 0, 1);
}

export async function classifyAcneSeverity(face: AlignedFace, modelPath: string): Promise<AcneSeverity> {
  if (!modelPath) return disabledSeverity('disabled');
  let expected: string;
  try {
    const meta = JSON.parse(await readFile(modelPath.replace(/\.onnx$/i, '.json'), 'utf8'));
    expected = String(meta.onnxSha256 ?? '');
    if (!/^[0-9a-f]{64}$/.test(expected)) return disabledSeverity('not_configured');
  } catch {
    return disabledSeverity('not_configured');
  }
  let session;
  try {
    session = await getOptionalSession(modelPath, expected);
  } catch {
    return disabledSeverity('not_configured');
  }
  const outputs = await runSession(session, faceSquareTensor(face), [1, INPUT, INPUT, 3]);
  const probs = Object.values(outputs)[0]?.data as Float32Array | undefined;
  if (!probs || probs.length !== LABELS.length) throw new Error('unexpected acne classifier output');
  let sum = 0;
  for (const v of probs) {
    if (!Number.isFinite(v) || v < 0) throw new Error('invalid acne classifier probabilities');
    sum += v;
  }
  if (Math.abs(sum - 1) > 0.01) throw new Error('acne classifier probabilities do not sum to 1');
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  return {
    status: 'ok',
    label: LABELS[best],
    scale: ACNE_SEVERITY_SCALE,
    probabilities: Object.fromEntries(LABELS.map((l, i) => [l, Math.round(probs[i] * 1000) / 1000])),
  };
}
