import type { RgbImage } from './decode';

/**
 * Affine map from destination pixel coordinates to source pixel coordinates:
 *   xs = a*xd + b*yd + tx
 *   ys = c*xd + d*yd + ty
 * Coordinates refer to pixel centres at integer + 0.5.
 */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export function applyAffine(m: Affine, x: number, y: number): [number, number] {
  return [m.a * x + m.b * y + m.tx, m.c * x + m.d * y + m.ty];
}

export function invertAffine(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  const a = m.d / det;
  const b = -m.b / det;
  const c = -m.c / det;
  const d = m.a / det;
  return { a, b, c, d, tx: -(a * m.tx + b * m.ty), ty: -(c * m.tx + d * m.ty) };
}

/**
 * Map for a rotated square/rectangular crop: destination (0..dstW, 0..dstH)
 * covers a box of size (boxW, boxH) centred at (cx, cy) in the source,
 * rotated by `rotation` radians (x axis of the crop points along
 * (cos r, sin r) in image coordinates, y down).
 */
export function cropAffine(
  cx: number,
  cy: number,
  boxW: number,
  boxH: number,
  rotation: number,
  dstW: number,
  dstH: number,
): Affine {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const sx = boxW / dstW;
  const sy = boxH / dstH;
  // dst -> centred box coords (u, v) -> rotate -> source
  const a = cos * sx;
  const b = -sin * sy;
  const c = sin * sx;
  const d = cos * sy;
  const u0 = -boxW / 2;
  const v0 = -boxH / 2;
  return { a, b, c, d, tx: cx + cos * u0 - sin * v0, ty: cy + sin * u0 + cos * v0 };
}

function samplesPerAxis(m: Affine): number {
  const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  return Math.max(1, Math.min(4, Math.ceil(scale - 0.05)));
}

/**
 * Resample an RGB image through an affine map with bilinear interpolation
 * and supersampling (anti-aliasing when shrinking). Returns 8-bit RGB plus a
 * mask of destination pixels that fall completely inside the source image.
 */
export function warpRgb(src: RgbImage, dstW: number, dstH: number, m: Affine): { rgb: Uint8Array; valid: Uint8Array } {
  const out = new Uint8Array(dstW * dstH * 3);
  const valid = new Uint8Array(dstW * dstH);
  const n = samplesPerAxis(m);
  const inv = 1 / (n * n);
  const { data, width: sw, height: sh } = src;
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let inside = 1;
      for (let j = 0; j < n; j++) {
        const yd = y + (j + 0.5) / n;
        for (let i = 0; i < n; i++) {
          const xd = x + (i + 0.5) / n;
          const xs = m.a * xd + m.b * yd + m.tx - 0.5;
          const ys = m.c * xd + m.d * yd + m.ty - 0.5;
          if (xs < -0.5 || ys < -0.5 || xs > sw - 0.5 || ys > sh - 0.5) inside = 0;
          const x0 = Math.max(0, Math.min(sw - 1, Math.floor(xs)));
          const y0 = Math.max(0, Math.min(sh - 1, Math.floor(ys)));
          const x1 = Math.min(sw - 1, x0 + 1);
          const y1 = Math.min(sh - 1, y0 + 1);
          const fx = Math.max(0, Math.min(1, xs - x0));
          const fy = Math.max(0, Math.min(1, ys - y0));
          const i00 = (y0 * sw + x0) * 3;
          const i10 = (y0 * sw + x1) * 3;
          const i01 = (y1 * sw + x0) * 3;
          const i11 = (y1 * sw + x1) * 3;
          const w00 = (1 - fx) * (1 - fy);
          const w10 = fx * (1 - fy);
          const w01 = (1 - fx) * fy;
          const w11 = fx * fy;
          r += data[i00] * w00 + data[i10] * w10 + data[i01] * w01 + data[i11] * w11;
          g += data[i00 + 1] * w00 + data[i10 + 1] * w10 + data[i01 + 1] * w01 + data[i11 + 1] * w11;
          b += data[i00 + 2] * w00 + data[i10 + 2] * w10 + data[i01 + 2] * w01 + data[i11 + 2] * w11;
        }
      }
      const o = (y * dstW + x) * 3;
      out[o] = Math.round(r * inv);
      out[o + 1] = Math.round(g * inv);
      out[o + 2] = Math.round(b * inv);
      valid[y * dstW + x] = inside;
    }
  }
  return { rgb: out, valid };
}

/** Convert interleaved 8-bit RGB to a float NHWC tensor scaled to [lo, hi]. */
export function rgbToTensor(rgb: Uint8Array, lo: number, hi: number): Float32Array {
  const out = new Float32Array(rgb.length);
  const scale = (hi - lo) / 255;
  for (let i = 0; i < rgb.length; i++) out[i] = lo + rgb[i] * scale;
  return out;
}

/** Bilinear sample of a single-channel plane (edges clamped). */
export function samplePlane(plane: Float32Array, w: number, h: number, xs: number, ys: number): number {
  const x = Math.max(0, Math.min(w - 1, xs - 0.5));
  const y = Math.max(0, Math.min(h - 1, ys - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  return (
    plane[y0 * w + x0] * (1 - fx) * (1 - fy) +
    plane[y0 * w + x1] * fx * (1 - fy) +
    plane[y1 * w + x0] * (1 - fx) * fy +
    plane[y1 * w + x1] * fx * fy
  );
}
