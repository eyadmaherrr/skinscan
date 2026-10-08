/**
 * Developer tool: renders what the pipeline "sees" for a photo — landmarks,
 * analysed regions, usable skin and segmentation vetoes — into a PNG.
 * Used to validate landmark placement and skin segmentation.
 *
 *   npx tsx scripts/debug-overlay.ts <photo.jpg> [out-dir]
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { alignFace } from '../lib/skin-analysis/alignment';
import { detectFaces } from '../lib/skin-analysis/face-detection';
import { decodeImage } from '../lib/skin-analysis/image/decode';
import { detectLandmarks } from '../lib/skin-analysis/landmarks';
import { buildRegions } from '../lib/skin-analysis/regions';
import { buildSkinMasks } from '../lib/skin-analysis/skin-mask';
import { estimatePose } from '../lib/skin-analysis/quality';
import { REGION_KEYS } from '../lib/skin-analysis/types';

const COLORS: Record<string, [number, number, number]> = {
  forehead: [255, 200, 0],
  nose: [255, 80, 80],
  cheekL: [80, 200, 120],
  cheekR: [80, 160, 255],
  chin: [200, 100, 255],
  underEyeL: [255, 140, 220],
  underEyeR: [0, 220, 220],
};

async function main() {
  const [input, outDir = 'test-data/debug'] = process.argv.slice(2);
  await mkdir(outDir, { recursive: true });
  const t0 = Date.now();
  const image = await decodeImage(await readFile(input), { maxInputPixels: 40e6, maxSide: 2560 });
  const detections = await detectFaces(image);
  const t1 = Date.now();
  console.log('faces', detections.map((d) => ({ score: +d.score.toFixed(3), w: Math.round(d.width), h: Math.round(d.height) })));
  if (!detections.length) return;
  const lm = await detectLandmarks(image, detections[0]);
  const t2 = Date.now();
  const face = await alignFace(image, lm.points);
  const t3 = Date.now();
  const regions = buildRegions(face.landmarks);
  const masks = buildSkinMasks(face, regions);
  const t4 = Date.now();
  const pose = estimatePose(lm.points);
  console.log('pose', { yaw: +pose.yaw.toFixed(1), pitch: +pose.pitch.toFixed(1), roll: +pose.roll.toFixed(1) });
  console.log({ presence: +lm.presence.toFixed(3), crop: [face.width, face.height], pxPerMm: +face.pxPerMm.toFixed(2), iod: Math.round(face.sourceIod) });
  console.log('timings ms', { detect: t1 - t0, landmarks: t2 - t1, alignSeg: t3 - t2, masks: t4 - t3 });
  console.log('coverage', Object.fromEntries(Object.entries(masks.coverage).map(([k, v]) => [k, +v.toFixed(2)])));

  const { width: w, height: h } = face;
  const out = Buffer.from(face.rgb);
  const tint = (i: number, c: [number, number, number], a: number) => {
    for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.round(out[i * 3 + k] * (1 - a) + c[k] * a);
  };
  for (let i = 0; i < w * h; i++) {
    if (face.seg.hair[i] >= 0.5) tint(i, [0, 0, 255], 0.35);
    else if (face.seg.others[i] >= 0.5) tint(i, [255, 0, 255], 0.45);
    else if (face.seg.background[i] >= 0.6) tint(i, [0, 0, 0], 0.5);
  }
  for (const key of REGION_KEYS) {
    const geo = regions.regions[key];
    const usable = masks.regions[key];
    for (let i = 0; i < w * h; i++) {
      if (usable[i]) tint(i, COLORS[key], 0.28);
      else if (geo[i]) tint(i, [255, 0, 0], 0.6);
    }
  }
  for (let p = 0; p < 478; p++) {
    const x = Math.round(face.landmarks.xy[p * 2]);
    const y = Math.round(face.landmarks.xy[p * 2 + 1]);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) tint(yy * w + xx, p >= 468 ? [255, 255, 0] : [255, 255, 255], 1);
    }
  }
  const name = path.basename(input, path.extname(input));
  await sharp(out, { raw: { width: w, height: h, channels: 3 } }).resize({ width: 700 }).png().toFile(path.join(outDir, `${name}-overlay.png`));
  console.log('wrote', path.join(outDir, `${name}-overlay.png`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
