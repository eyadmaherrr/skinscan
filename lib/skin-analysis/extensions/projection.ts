import sharp from 'sharp';
import type { AlignedFace } from '../alignment';
import type { RgbImage } from '../image/decode';
import { applyAffine, invertAffine, samplePlane } from '../image/warp';

/**
 * Helpers that map results from the aligned face crop back onto the original
 * photo, so overlays line up with the image the user sees (the decoded image
 * has the same aspect ratio as the uploaded one).
 */

export function toNormalized(face: AlignedFace, image: RgbImage, x: number, y: number): [number, number] {
  const [xs, ys] = applyAffine(face.cropToSource, x + 0.5, y + 0.5);
  return [round4(xs / image.width), round4(ys / image.height)];
}

/** Source pixels per crop pixel. */
export function cropToSourceScale(face: AlignedFace): number {
  return Math.hypot(face.cropToSource.a, face.cropToSource.c);
}

export function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

const HEATMAP_MAX_WIDTH = 360;

/**
 * Render a 0–1 map defined on the crop into a transparent PNG covering the
 * whole photo (same aspect ratio), as a data URI. Colour runs from light
 * blue (low) to violet (high); alpha follows the value, so low values stay
 * nearly invisible and the photo remains readable underneath.
 */
export async function renderHeatmap(face: AlignedFace, image: RgbImage, values: Float32Array): Promise<string> {
  const ow = Math.min(HEATMAP_MAX_WIDTH, image.width);
  const oh = Math.max(1, Math.round((image.height * ow) / image.width));
  const toCrop = invertAffine(face.cropToSource);
  const rgba = Buffer.alloc(ow * oh * 4);
  const sx = image.width / ow;
  const sy = image.height / oh;
  for (let v = 0; v < oh; v++) {
    for (let u = 0; u < ow; u++) {
      const [xc, yc] = applyAffine(toCrop, (u + 0.5) * sx, (v + 0.5) * sy);
      if (xc < 0 || yc < 0 || xc >= face.width || yc >= face.height) continue;
      const value = Math.max(0, Math.min(1, samplePlane(values, face.width, face.height, xc, yc)));
      if (value < 0.04) continue;
      const o = (v * ow + u) * 4;
      rgba[o] = Math.round(70 + 110 * value);
      rgba[o + 1] = Math.round(190 - 150 * value);
      rgba[o + 2] = Math.round(235 - 15 * value);
      rgba[o + 3] = Math.round(40 + 160 * value);
    }
  }
  const png = await sharp(rgba, { raw: { width: ow, height: oh, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}
