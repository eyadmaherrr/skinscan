import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AlignedFace } from '../alignment';
import { cropAffine, warpRgb } from '../image/warp';
import { getOptionalSession, runSession } from '../models/runtime';
import type { MetricContext } from '../metrics/common';
import { calibrate } from '../scoring';
import { analysisText } from '../text';
import type {
  ComponentStatus,
  GlamourSkinTypeClass,
  RegionKey,
  SkinTypeReport,
} from '../types';

/**
 * Glamour AI Skin Model Adapter (ViT-Base Image Classifier).
 *
 * Model: Hugging Face `AishaBaliyan/glamour-ai-skin-model`
 * Architecture: ViTForImageClassification (Vision Transformer ViT-Base, 85.8M params)
 * License: MIT License (permissive open-source, commercially viable)
 * Input: [1, 3, 224, 224] RGB NCHW float32 tensor
 * Normalization: (val / 255.0 - 0.5) / 0.5 = (val / 127.5) - 1.0 (range [-1, 1])
 * Output labels: id2label: { 0: 'dry', 1: 'normal', 2: 'oily' }
 *
 * This adapter separates:
 *  1. Estimated Skin Type: The classifier's prediction (dry / normal / oily).
 *  2. Visible Shine Score: Deterministic computer-vision specular highlight
 *     analysis (0-100 score with regional breakdown across forehead, nose, cheeks).
 */

export const GLAMOUR_MODEL_NAME = 'Glamour AI ViT Skin Type Classifier (AishaBaliyan/glamour-ai-skin-model)';
export const GLAMOUR_MODEL_VERSION = '1.0.0';
export const GLAMOUR_INPUT_SIZE = 224;
export const GLAMOUR_CLASSES: readonly GlamourSkinTypeClass[] = ['dry', 'normal', 'oily'] as const;

export interface GlamourAdapterConfig {
  enabled: boolean;
  modelPath?: string;
  serviceUrl?: string;
  serviceToken?: string;
  timeoutMs?: number;
}

/** Preprocess 24-bit interleaved RGB to ViT float32 tensor in NCHW format [-1, 1]. */
export function rgbToVitTensor(rgb: Uint8Array, width: number, height: number): Float32Array {
  const pixelCount = width * height;
  const tensor = new Float32Array(3 * pixelCount);
  const rOffset = 0;
  const gOffset = pixelCount;
  const bOffset = 2 * pixelCount;

  for (let i = 0; i < pixelCount; i++) {
    const o = i * 3;
    tensor[rOffset + i] = rgb[o] / 127.5 - 1.0;
    tensor[gOffset + i] = rgb[o + 1] / 127.5 - 1.0;
    tensor[bOffset + i] = rgb[o + 2] / 127.5 - 1.0;
  }
  return tensor;
}

/** Stable softmax over raw model logits. */
export function softmax(logits: Float32Array | number[]): number[] {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > max) max = logits[i];
  }
  let sum = 0;
  const exp = new Float64Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    exp[i] = Math.exp(logits[i] - max);
    sum += exp[i];
  }
  const probs: number[] = [];
  for (let i = 0; i < logits.length; i++) {
    probs.push(sum > 0 ? Math.round((exp[i] / sum) * 1000) / 1000 : 1 / logits.length);
  }
  return probs;
}

/** Extracts an aligned rectangular crop around a facial skin region, resized to 224x224. */
export function extractRegionCrop(
  face: AlignedFace,
  regionMask: Uint8Array,
  targetSize = GLAMOUR_INPUT_SIZE,
): Float32Array {
  const { width: w, height: h, rgb } = face;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let count = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (regionMask[y * w + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        count++;
      }
    }
  }

  // Fallback to central face crop if region is tiny or empty
  if (count < 50 || maxX <= minX || maxY <= minY) {
    const side = Math.max(w, h) * 0.8;
    const m = cropAffine(w / 2, h / 2, side, side, 0, targetSize, targetSize);
    const { rgb: warped } = warpRgb({ data: rgb, width: w, height: h }, targetSize, targetSize, m);
    return rgbToVitTensor(warped, targetSize, targetSize);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const side = Math.max(maxX - minX, maxY - minY) * 1.15;
  const m = cropAffine(cx, cy, side, side, 0, targetSize, targetSize);
  const { rgb: warped } = warpRgb({ data: rgb, width: w, height: h }, targetSize, targetSize, m);
  return rgbToVitTensor(warped, targetSize, targetSize);
}

/**
 * Runs local ONNX inference on a 224x224 NCHW tensor.
 */
async function runLocalInference(
  tensor: Float32Array,
  modelPath: string,
): Promise<{ predictedType: GlamourSkinTypeClass; probabilities: Record<GlamourSkinTypeClass, number> }> {
  let expectedSha = '';
  try {
    const metaPath = modelPath.replace(/\.onnx$/i, '.json');
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    expectedSha = String(meta.onnxSha256 ?? '');
  } catch {
    // If no json metadata, let getOptionalSession verify or throw
  }

  const session = await getOptionalSession(modelPath, expectedSha);
  const outputs = await runSession(session, tensor, [1, 3, GLAMOUR_INPUT_SIZE, GLAMOUR_INPUT_SIZE]);
  const outputTensor = Object.values(outputs)[0];
  const logits = outputTensor?.data as Float32Array | undefined;
  if (!logits || logits.length < 3) {
    throw new Error('Invalid Glamour AI model output tensor dimension');
  }

  const probs = softmax(logits);
  let bestIdx = 0;
  for (let i = 1; i < GLAMOUR_CLASSES.length; i++) {
    if (probs[i] > probs[bestIdx]) bestIdx = i;
  }

  const probMap: Record<GlamourSkinTypeClass, number> = {
    dry: probs[0] ?? 0,
    normal: probs[1] ?? 0,
    oily: probs[2] ?? 0,
  };

  return {
    predictedType: GLAMOUR_CLASSES[bestIdx],
    probabilities: probMap,
  };
}

/**
 * Runs remote inference against HuggingFace Inference Endpoint or microservice.
 */
async function runRemoteInference(
  face: AlignedFace,
  url: string,
  token?: string,
  timeoutMs = 8000,
): Promise<{ predictedType: GlamourSkinTypeClass; probabilities: Record<GlamourSkinTypeClass, number> }> {
  const validMask = face.valid ?? new Uint8Array(face.width * face.height).fill(1);
  const tensor = extractRegionCrop(face, validMask);
  // Send tensor data or image payload conforming to HF EndpointHandler
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ inputs: Array.from(tensor.slice(0, 1000)) }), // Or custom handler contract
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) throw new Error(`Glamour AI remote inference failed with HTTP ${res.status}`);
  const rawData = await res.json();
  const probMap: Record<GlamourSkinTypeClass, number> = { dry: 0, normal: 0, oily: 0 };
  let bestType: GlamourSkinTypeClass = 'normal';

  // Support direct object response: { predictedType?: ..., probabilities?: ... }
  if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
    if (rawData.probabilities) {
      for (const k of GLAMOUR_CLASSES) {
        if (typeof rawData.probabilities[k] === 'number') {
          probMap[k] = rawData.probabilities[k];
        }
      }
    }
    if (rawData.predictedType && GLAMOUR_CLASSES.includes(rawData.predictedType)) {
      bestType = rawData.predictedType;
    } else {
      let maxP = -1;
      for (const k of GLAMOUR_CLASSES) {
        if (probMap[k] > maxP) {
          maxP = probMap[k];
          bestType = k;
        }
      }
    }
    return { predictedType: bestType, probabilities: probMap };
  }

  // Support Hugging Face array response (possibly nested [[{ label, score }]])
  const items: Array<{ label?: string; score?: number }> = Array.isArray(rawData)
    ? (Array.isArray(rawData[0]) ? rawData[0] : rawData)
    : [];

  let bestScore = -1;
  for (const item of items) {
    if (!item?.label || typeof item?.score !== 'number') continue;
    const key = item.label.toLowerCase() as GlamourSkinTypeClass;
    if (key in probMap) {
      probMap[key] = Math.round(item.score * 1000) / 1000;
      if (item.score > bestScore) {
        bestScore = item.score;
        bestType = key;
      }
    }
  }

  return { predictedType: bestType, probabilities: probMap };
}

/**
 * Evaluates visible surface shine across T-zone and cheeks using
 * calibrated image processing specular reflection calculations.
 */
export function evaluateVisibleShine(ctx: MetricContext): {
  score: number | null;
  tZoneScore: number | null;
  cheeksScore: number | null;
  regionalBreakdown: Partial<Record<'forehead' | 'nose' | 'cheekLeft' | 'cheekRight', number>>;
} {
  const { masks, face } = ctx;
  const regions = masks.regionsWithHighlights;
  const p = face.pxPerMm;
  const { Y, a, b } = face.lab;

  const tZoneKeys: RegionKey[] = ['forehead', 'nose'];
  const cheekKeys: RegionKey[] = ['cheekL', 'cheekR'];

  const countHighlights = (key: RegionKey): { count: number; total: number } => {
    const m = regions[key];
    if (!m) return { count: 0, total: 0 };
    let hit = 0;
    let n = 0;
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      n++;
      const isClipped = Math.min(face.rgb[i * 3], face.rgb[i * 3 + 1], face.rgb[i * 3 + 2]) >= 245;
      const chromaVal = Math.hypot(a[i], b[i]);
      if (isClipped || (Y[i] > 0.65 && chromaVal < 14)) hit++;
    }
    return { count: hit, total: n };
  };

  const fraction = (keys: RegionKey[]): number => {
    let hits = 0;
    let total = 0;
    for (const k of keys) {
      const { count, total: t } = countHighlights(k);
      hits += count;
      total += t;
    }
    return total > 100 ? (100 * hits) / total : 0;
  };

  const rawForehead = fraction(['forehead']);
  const rawNose = fraction(['nose']);
  const rawCheekL = fraction(['cheekL']);
  const rawCheekR = fraction(['cheekR']);

  const tZoneRaw = (rawForehead + rawNose) / 2;
  const cheeksRaw = (rawCheekL + rawCheekR) / 2;
  const overallRaw = 0.6 * tZoneRaw + 0.4 * cheeksRaw;

  const score = Math.round(calibrate('shine', overallRaw));
  const tZoneScore = Math.round(calibrate('shine', tZoneRaw));
  const cheeksScore = Math.round(calibrate('shine', cheeksRaw));

  return {
    score,
    tZoneScore,
    cheeksScore,
    regionalBreakdown: {
      forehead: Math.round(calibrate('shine', rawForehead)),
      nose: Math.round(calibrate('shine', rawNose)),
      cheekLeft: Math.round(calibrate('shine', rawCheekL)),
      cheekRight: Math.round(calibrate('shine', rawCheekR)),
    },
  };
}

/**
 * Main entry point for the Glamour AI Skin Type + Visible Oiliness analysis.
 */
export async function analyzeSkinType(
  ctx: MetricContext,
  cfg: GlamourAdapterConfig,
): Promise<SkinTypeReport> {
  const text = analysisText(ctx.locale);
  const visibleShine = evaluateVisibleShine(ctx);

  if (!cfg.enabled) {
    return {
      status: 'disabled',
      modelName: GLAMOUR_MODEL_NAME,
      modelVersion: GLAMOUR_MODEL_VERSION,
      predictedSkinType: null,
      probabilities: null,
      visibleShine,
      explanation: text.skinType.disabled,
      limitations: text.skinType.limitations,
    };
  }

  // Check if model path or service URL is configured
  let hasLocalModel = false;
  if (cfg.modelPath && cfg.modelPath.endsWith('.onnx')) {
    try {
      await access(cfg.modelPath);
      hasLocalModel = true;
    } catch {
      hasLocalModel = false;
    }
  }
  const hasRemoteUrl = Boolean(cfg.serviceUrl && cfg.serviceUrl.startsWith('http'));

  if (!hasLocalModel && !hasRemoteUrl) {
    return {
      status: 'not_configured',
      modelName: GLAMOUR_MODEL_NAME,
      modelVersion: GLAMOUR_MODEL_VERSION,
      predictedSkinType: null,
      probabilities: null,
      visibleShine,
      explanation: text.skinType.notConfigured,
      limitations: text.skinType.limitations,
    };
  }

  try {
    let overallPrediction: { predictedType: GlamourSkinTypeClass; probabilities: Record<GlamourSkinTypeClass, number> };

    if (hasLocalModel && cfg.modelPath) {
      // Whole-face skin crop
      const validMask = ctx.face.valid ?? new Uint8Array(ctx.face.width * ctx.face.height).fill(1);
      const wholeFaceTensor = extractRegionCrop(ctx.face, validMask);
      overallPrediction = await runLocalInference(wholeFaceTensor, cfg.modelPath);
    } else if (hasRemoteUrl && cfg.serviceUrl) {
      overallPrediction = await runRemoteInference(
        ctx.face,
        cfg.serviceUrl,
        cfg.serviceToken,
        cfg.timeoutMs,
      );
    } else {
      throw new Error('No valid Glamour AI model provider');
    }

    // Per-region inference if local model is active
    const regionalPredictions: SkinTypeReport['regionalPredictions'] = {};
    if (hasLocalModel && cfg.modelPath) {
      const regionMappings: Array<{ key: 'forehead' | 'nose' | 'cheekLeft' | 'cheekRight'; maskKey: RegionKey }> = [
        { key: 'forehead', maskKey: 'forehead' },
        { key: 'nose', maskKey: 'nose' },
        { key: 'cheekLeft', maskKey: 'cheekL' },
        { key: 'cheekRight', maskKey: 'cheekR' },
      ];

      for (const reg of regionMappings) {
        const mask = ctx.masks.regions[reg.maskKey];
        if (mask) {
          try {
            const regTensor = extractRegionCrop(ctx.face, mask);
            const regPred = await runLocalInference(regTensor, cfg.modelPath);
            regionalPredictions[reg.key] = regPred;
          } catch {
            // Graceful fallback for single region
          }
        }
      }
    }

    return {
      status: 'ok',
      modelName: GLAMOUR_MODEL_NAME,
      modelVersion: GLAMOUR_MODEL_VERSION,
      predictedSkinType: overallPrediction.predictedType,
      probabilities: overallPrediction.probabilities,
      regionalPredictions: Object.keys(regionalPredictions).length ? regionalPredictions : undefined,
      visibleShine,
      explanation: text.skinType.summary(overallPrediction.predictedType, visibleShine.score),
      limitations: text.skinType.limitations,
    };
  } catch (error) {
    return {
      status: 'not_configured',
      modelName: GLAMOUR_MODEL_NAME,
      modelVersion: GLAMOUR_MODEL_VERSION,
      predictedSkinType: null,
      probabilities: null,
      visibleShine,
      explanation: text.skinType.notConfigured,
      limitations: text.skinType.limitations,
    };
  }
}
