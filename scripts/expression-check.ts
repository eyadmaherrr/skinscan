/**
 * Prints the expression measurements (smile score and its parts) for photos,
 * to check the smile detector against what the photos actually show.
 *
 *   npx tsx scripts/expression-check.ts photo.jpg [...]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { alignFace } from '../lib/skin-analysis/alignment';
import { detectFaces } from '../lib/skin-analysis/face-detection';
import { decodeImage } from '../lib/skin-analysis/image/decode';
import { detectLandmarks } from '../lib/skin-analysis/landmarks';
import { smileScore } from '../lib/skin-analysis/quality';

async function main() {
  for (const file of process.argv.slice(2)) {
    const image = await decodeImage(await readFile(file), { maxInputPixels: 40e6, maxSide: 2560 });
    const faces = await detectFaces(image);
    if (!faces.length) {
      console.log(`${path.basename(file)}\tno face`);
      continue;
    }
    const lm = await detectLandmarks(image, faces[0]);
    const face = await alignFace(image, lm.points);
    const s = smileScore(face);
    console.log(
      `${path.basename(file)}\tsmile=${s.smile.toFixed(2)}\twidth=${s.mouthWidth.toFixed(2)}\topening=${s.opening.toFixed(2)}\tcornerLift=${s.cornerLift.toFixed(3)}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
