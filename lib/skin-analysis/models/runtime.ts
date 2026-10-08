import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { InferenceSession, Tensor } from 'onnxruntime-node';
import { serverConfig } from '../../config';

/**
 * ONNX Runtime wrapper. Models are loaded once per server process, checked
 * against the SHA-256 checksums in models/manifest.json, and reused.
 * Swapping a model = replacing the file + its manifest entry + the
 * pre/post-processing module that uses it.
 */

export type ModelName = 'faceDetector' | 'faceLandmarks' | 'faceSegmenter';

interface ManifestEntry {
  file: string;
  sha256: string;
}

type Manifest = Record<ModelName, ManifestEntry>;

type Ort = typeof import('onnxruntime-node');

const globalCache = globalThis as unknown as {
  __skinScanOrt?: Promise<Ort>;
  __skinScanSessions?: Map<ModelName, Promise<InferenceSession>>;
  __skinScanManifest?: Promise<Manifest>;
};

function ort(): Promise<Ort> {
  globalCache.__skinScanOrt ??= import('onnxruntime-node');
  return globalCache.__skinScanOrt;
}

function manifest(): Promise<Manifest> {
  globalCache.__skinScanManifest ??= readFile(path.join(serverConfig.modelDir, 'manifest.json'), 'utf8').then(
    (text) => JSON.parse(text).models as Manifest,
  );
  return globalCache.__skinScanManifest;
}

async function loadSession(name: ModelName): Promise<InferenceSession> {
  const entry = (await manifest())[name];
  if (!entry) throw new Error(`model ${name} missing from manifest`);
  const bytes = await readFile(path.join(serverConfig.modelDir, entry.file));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== entry.sha256) throw new Error(`model ${name} failed checksum verification`);
  const { InferenceSession } = await ort();
  return InferenceSession.create(bytes, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
    intraOpNumThreads: serverConfig.onnxThreads,
    interOpNumThreads: 1,
  });
}

export function getSession(name: ModelName): Promise<InferenceSession> {
  const sessions = (globalCache.__skinScanSessions ??= new Map());
  let session = sessions.get(name);
  if (!session) {
    session = loadSession(name);
    // Do not cache failures, so a transient error can recover on the next request.
    session.catch(() => sessions.delete(name));
    sessions.set(name, session);
  }
  return session;
}

/** Run a single-input model and return its outputs by name. */
export async function runModel(
  name: ModelName,
  input: Float32Array,
  dims: readonly number[],
): Promise<Record<string, Tensor>> {
  const session = await getSession(name);
  const { Tensor } = await ort();
  const feeds = { [session.inputNames[0]]: new Tensor('float32', input, dims) };
  return session.run(feeds);
}

/** Load every model up front (used by the health check and to fail fast at start-up). */
export async function warmUp(): Promise<void> {
  await Promise.all((['faceDetector', 'faceLandmarks', 'faceSegmenter'] as ModelName[]).map(getSession));
}
