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

/** Heatmap colour ramp: RGB at value 0 and at value 1. */
export type Palette = readonly [readonly [number, number, number], readonly [number, number, number]];

export const PALETTES = {
  /** Light blue → violet (pores). */
  violet: [[70, 190, 235], [180, 40, 220]],
  redness: [[255, 170, 170], [214, 32, 62]],
  pigmentation: [[236, 196, 132], [128, 72, 28]],
  texture: [[140, 226, 214], [0, 128, 128]],
  shine: [[255, 248, 196], [255, 196, 0]],
} as const satisfies Record<string, Palette>;

/**
 * Render a 0–1 map defined on the crop into a transparent PNG covering the
 * whole photo (same aspect ratio), as a data URI. Colour runs along the
 * palette from low to high; alpha follows the value, so low values stay
 * nearly invisible and the photo remains readable underneath.
 */
export async function renderHeatmap(
  face: AlignedFace,
  image: RgbImage,
  values: Float32Array,
  palette: Palette = PALETTES.violet,
): Promise<string> {
  const [[r0, g0, b0], [r1, g1, b1]] = palette;
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
      rgba[o] = Math.round(r0 + (r1 - r0) * value);
      rgba[o + 1] = Math.round(g0 + (g1 - g0) * value);
      rgba[o + 2] = Math.round(b0 + (b1 - b0) * value);
      rgba[o + 3] = Math.round(40 + 160 * value);
    }
  }
  const png = await sharp(rgba, { raw: { width: ow, height: oh, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}
