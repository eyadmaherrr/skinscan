/**
 * Derives the left/right mirror table of the 478 Face Mesh landmarks
 * (lib/skin-analysis/landmark-mirror.ts) from the model itself: landmark i of
 * a photo and landmark MIRROR[i] of the mirrored photo sit on the same place
 * of the face. For every pair (i, j) the script averages, over the reference
 * faces, the offset between landmark i and landmark j of the mirrored photo
 * (mirrored back), and picks for each i the j with the smallest mean offset.
 * The result must be a one-to-one map that is its own inverse and must agree
 * with the left/right contours in face-topology.ts, or the script fails.
 *
 *   npx tsx scripts/derive-landmark-mirror.ts            # check against the committed table
 *   npx tsx scripts/derive-landmark-mirror.ts --write    # rewrite the table
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { detectFaces } from '../lib/skin-analysis/face-detection';
import {
  BROW_LOWER_IMG_LEFT,
  BROW_LOWER_IMG_RIGHT,
  BROW_UPPER_IMG_LEFT,
  BROW_UPPER_IMG_RIGHT,
  EYE_IMG_LEFT,
  EYE_IMG_RIGHT,
  FOREHEAD_ARC,
  IRIS_RING_IMG_LEFT,
  IRIS_RING_IMG_RIGHT,
  LANDMARK_COUNT,
  LM,
} from '../lib/skin-analysis/face-topology';
import { decodeImage } from '../lib/skin-analysis/image/decode';
import { roiFromDetection, roiFromLandmarks, runLandmarks } from '../lib/skin-analysis/landmarks';

const REF = path.join(process.cwd(), 'test-data', 'reference');
const OUT = path.join(process.cwd(), 'lib', 'skin-analysis', 'landmark-mirror.ts');
const N = LANDMARK_COUNT;

/** Landmarks of one image from the plain two-pass model (no mirror averaging), or null without a face. */
async function rawLandmarks(buffer: Buffer): Promise<{ points: Float32Array; width: number } | null> {
  const image = await decodeImage(buffer, { maxInputPixels: 40e6, maxSide: 2560 });
  const faces = await detectFaces(image);
  if (!faces.length) return null;
  const first = await runLandmarks(image, roiFromDetection(faces[0]), false);
  const refined = await runLandmarks(image, roiFromLandmarks(first.points), false);
  if (Math.min(first.presence, refined.presence) < 0.5) return null;
  return { points: refined.points, width: image.width };
}

async function main() {
  const files = (await readdir(REF)).filter((f) => /\.jpe?g$/i.test(f));
  // Sum over faces of the offset (i in the photo) − (j in the mirrored photo, mirrored back), in IOD units.
  const sum = new Float64Array(N * N * 3);
  let faces = 0;
  for (const f of files) {
    const src = await readFile(path.join(REF, f));
    const a = await rawLandmarks(await sharp(src).png().toBuffer());
    const b = await rawLandmarks(await sharp(src).flop().png().toBuffer());
    if (!a || !b) continue;
    const p = a.points;
    const q = b.points;
    const iod = Math.hypot(
      p[LM.eyeOuterImgRight * 3] - p[LM.eyeOuterImgLeft * 3],
      p[LM.eyeOuterImgRight * 3 + 1] - p[LM.eyeOuterImgLeft * 3 + 1],
    );
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const o = (i * N + j) * 3;
        sum[o] += (p[i * 3] - (a.width - q[j * 3])) / iod;
        sum[o + 1] += (p[i * 3 + 1] - q[j * 3 + 1]) / iod;
        sum[o + 2] += (p[i * 3 + 2] - q[j * 3 + 2]) / iod;
      }
    }
    faces++;
  }
  if (faces < 8) throw new Error(`only ${faces} usable faces in ${REF} (run scripts/fetch-test-images.ts)`);

  // A mirror pair (i, j) must be close both ways round (i ↔ j and j ↔ i). Pairs are matched from
  // the closest upwards, each landmark once, so tightly packed points (the mouth corners) cannot
  // all claim the same partner as a plain nearest-neighbour search would let them.
  const dist = (i: number, j: number) => {
    const o = (i * N + j) * 3;
    return Math.hypot(sum[o], sum[o + 1], sum[o + 2]) / faces;
  };
  const pairs: { i: number; j: number; cost: number }[] = [];
  for (let i = 0; i < N; i++) for (let j = i; j < N; j++) pairs.push({ i, j, cost: (dist(i, j) + dist(j, i)) / 2 });
  pairs.sort((a, b) => a.cost - b.cost);
  const mirror = new Int32Array(N).fill(-1);
  let worst = 0;
  for (const { i, j, cost } of pairs) {
    if (mirror[i] !== -1 || mirror[j] !== -1) continue;
    mirror[i] = j;
    mirror[j] = i;
    worst = Math.max(worst, cost);
  }
  // How clearly each landmark's partner beats its best alternative.
  let closestRival = Infinity;
  for (let i = 0; i < N; i++) {
    let rival = Infinity;
    for (let j = 0; j < N; j++) if (j !== mirror[i]) rival = Math.min(rival, dist(i, j));
    closestRival = Math.min(closestRival, rival / Math.max(dist(i, mirror[i]), 1e-6));
  }

  // The map must be a permutation that is its own inverse…
  const errors: string[] = [];
  for (let i = 0; i < N; i++) if (mirror[mirror[i]] !== i) errors.push(`mirror[mirror[${i}]] = ${mirror[mirror[i]]}`);
  // …and agree with the contours already written down by hand.
  const known: [number, number][] = [
    ...EYE_IMG_LEFT.map((v, k) => [v, EYE_IMG_RIGHT[k]] as [number, number]),
    ...BROW_UPPER_IMG_LEFT.map((v, k) => [v, BROW_UPPER_IMG_RIGHT[k]] as [number, number]),
    ...BROW_LOWER_IMG_LEFT.map((v, k) => [v, BROW_LOWER_IMG_RIGHT[k]] as [number, number]),
    ...FOREHEAD_ARC.map((v, k) => [v, FOREHEAD_ARC[FOREHEAD_ARC.length - 1 - k]] as [number, number]),
    [LM.mouthCornerImgLeft, LM.mouthCornerImgRight],
    [LM.faceSideImgLeft, LM.faceSideImgRight],
    [LM.irisImgLeft, LM.irisImgRight],
    [LM.noseTip, LM.noseTip],
    [LM.noseBridge, LM.noseBridge],
    [LM.chin, LM.chin],
    [LM.upperLipInner, LM.upperLipInner],
    [LM.lowerLipInner, LM.lowerLipInner],
  ];
  for (const [l, r] of known) if (mirror[l] !== r) errors.push(`expected ${l} ↔ ${r}, derived ${l} → ${mirror[l]}`);
  const irisLeft = new Set(IRIS_RING_IMG_LEFT);
  for (const r of IRIS_RING_IMG_RIGHT) if (!irisLeft.has(mirror[r])) errors.push(`iris ring ${r} → ${mirror[r]}`);

  const selfMapped = Array.from(mirror).filter((v, i) => v === i).length;
  console.log(
    `${faces} faces · worst mean offset of a chosen pair ${(100 * worst).toFixed(2)}% IOD · nearest rival at least ${closestRival.toFixed(1)}× farther · ${selfMapped} midline points`,
  );
  if (errors.length) {
    console.error(errors.slice(0, 20).join('\n'));
    throw new Error(`${errors.length} inconsistencies: the table was not written`);
  }

  const rows: string[] = [];
  for (let i = 0; i < N; i += 20) rows.push('  ' + Array.from(mirror.subarray(i, i + 20)).join(', ') + ',');
  const source = `/**
 * Left/right mirror table of the 478 Face Mesh landmarks: landmark i on a
 * photo corresponds to landmark LANDMARK_MIRROR[i] on the mirrored photo
 * (midline points map to themselves). Generated and verified by
 * scripts/derive-landmark-mirror.ts — do not edit by hand.
 */
export const LANDMARK_MIRROR: readonly number[] = [
${rows.join('\n')}
];
`;
  if (process.argv.includes('--write')) {
    await writeFile(OUT, source);
    console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
  } else {
    const current = await readFile(OUT, 'utf8').catch(() => '');
    console.log(current === source ? 'the committed table matches' : 'the committed table DIFFERS (run with --write)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
