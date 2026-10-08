/**
 * Developer tool: renders the per-pixel evidence behind the colour metrics
 * (redness excess, pigmentation darkening) as heat maps over the aligned face.
 *
 *   npx tsx scripts/debug-maps.ts <photo.jpg> [out-dir]
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { exposureGain } from '../lib/skin-analysis';
import { alignFace } from '../lib/skin-analysis/alignment';
import { detectFaces } from '../lib/skin-analysis/face-detection';
import { rgbToLabImage } from '../lib/skin-analysis/image/color';
import { decodeImage } from '../lib/skin-analysis/image/decode';
import { detectLandmarks } from '../lib/skin-analysis/landmarks';
import { pigmentEvidence } from '../lib/skin-analysis/metrics/pigmentation';
import { estimatePose, assessAlignedFace } from '../lib/skin-analysis/quality';
import { buildRegions } from '../lib/skin-analysis/regions';
import { buildSkinMasks } from '../lib/skin-analysis/skin-mask';
import { maskedGaussianBlur } from '../lib/skin-analysis/image/filters';

async function main() {
  const [input, outDir = 'test-data/debug'] = process.argv.slice(2);
  await mkdir(outDir, { recursive: true });
  const image = await decodeImage(await readFile(input), { maxInputPixels: 40e6, maxSide: 2560 });
  const [det] = await detectFaces(image);
  const lm = await detectLandmarks(image, det);
  const face = await alignFace(image, lm.points);
  const regions = buildRegions(face.landmarks);
  const masks = buildSkinMasks(face, regions);
  const q = assessAlignedFace(face, regions, masks.geometric, masks.all, estimatePose(lm.points));
  face.lab = rgbToLabImage(face.rgb, face.width * face.height, exposureGain(q.diagnostics.scleraY));
  const { width: w, height: h } = face;
  const p = face.pxPerMm;

  const pig = pigmentEvidence(face, masks.all);
  const a = maskedGaussianBlur(face.lab.a, masks.all, w, h, 0.5 * p);
  const render = async (values: Float32Array, scale: number, name: string) => {
    const out = Buffer.from(face.rgb);
    for (let i = 0; i < w * h; i++) {
      if (!masks.all[i]) {
        for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(out[i * 3 + c] * 0.35);
        continue;
      }
      const v = Math.max(0, Math.min(1, values[i] / scale));
      out[i * 3] = Math.round(255 * v);
      out[i * 3 + 1] = Math.round(60 * (1 - v));
      out[i * 3 + 2] = Math.round(255 * (1 - v));
    }
    const file = path.join(outDir, `${path.basename(input, path.extname(input))}-${name}.png`);
    await sharp(out, { raw: { width: w, height: h, channels: 3 } }).resize({ width: 520 }).png().toFile(file);
    console.log('wrote', file);
  };
  await render(pig, 6, 'pigment');
  const vals = Array.from(a).filter((_, i) => masks.all[i]).sort((x, y) => x - y);
  const base = vals[Math.floor(vals.length * 0.2)];
  await render(a.map((v) => v - base), 8, 'redness');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
