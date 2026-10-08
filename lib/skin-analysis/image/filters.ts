/**
 * Small, dependency-free image filters on single-channel Float32 planes.
 * Large Gaussian blurs use the standard three-pass box-filter approximation
 * so their cost does not grow with the blur radius.
 */

export interface Plane {
  data: Float32Array;
  width: number;
  height: number;
}

function gaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  return kernel;
}

function convolveSeparable(src: Float32Array, w: number, h: number, kernel: Float32Array): Float32Array {
  const radius = (kernel.length - 1) >> 1;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        let xx = x + k;
        if (xx < 0) xx = 0;
        else if (xx >= w) xx = w - 1;
        acc += src[row + xx] * kernel[k + radius];
      }
      tmp[row + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        let yy = y + k;
        if (yy < 0) yy = 0;
        else if (yy >= h) yy = h - 1;
        acc += tmp[yy * w + x] * kernel[k + radius];
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

/** Running-sum box blur of radius r along rows then columns (edges clamped). */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * norm;
      const add = Math.min(w - 1, x + r + 1);
      const sub = Math.max(0, x - r);
      acc += src[row + add] - src[row + sub];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * norm;
      const add = Math.min(h - 1, y + r + 1);
      const sub = Math.max(0, y - r);
      acc += tmp[add * w + x] - tmp[sub * w + x];
    }
  }
  return out;
}

/** Box radii whose three-pass composition approximates a Gaussian of the given sigma. */
function boxRadiiForGauss(sigma: number): number[] {
  const n = 3;
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  const radii: number[] = [];
  for (let i = 0; i < n; i++) radii.push(((i < m ? wl : wu) - 1) / 2);
  return radii;
}

/** Gaussian blur. Exact for small sigma, box-approximated for large sigma. */
export function gaussianBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma < 0.3) return src.slice();
  if (sigma <= 3) return convolveSeparable(src, w, h, gaussianKernel(sigma));
  let out = src;
  for (const r of boxRadiiForGauss(sigma)) out = boxBlur(out, w, h, r);
  return out === src ? src.slice() : out;
}

/**
 * Normalised convolution: Gaussian average of `src` using only pixels where
 * `mask` is set, so values outside the mask (hair, background, eyes) do not
 * bleed into the result. Pixels with almost no masked support get `fallback`.
 */
export function maskedGaussianBlur(
  src: Float32Array,
  mask: Uint8Array,
  w: number,
  h: number,
  sigma: number,
  fallback?: Float32Array,
): Float32Array {
  const weighted = new Float32Array(src.length);
  const weights = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    if (mask[i]) {
      weighted[i] = src[i];
      weights[i] = 1;
    }
  }
  const num = gaussianBlur(weighted, w, h, sigma);
  const den = gaussianBlur(weights, w, h, sigma);
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    out[i] = den[i] > 1e-3 ? num[i] / den[i] : fallback ? fallback[i] : src[i];
  }
  return out;
}

/** Count of set mask pixels in a (2r+1)x(2r+1) window around each pixel. */
function windowCount(mask: Uint8Array, w: number, h: number, r: number): Int32Array {
  const tmp = new Int32Array(mask.length);
  const out = new Int32Array(mask.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let k = -r; k <= r; k++) {
      const x = k;
      if (x >= 0 && x < w) acc += mask[row + x];
    }
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc;
      const add = x + r + 1;
      const sub = x - r;
      if (add < w) acc += mask[row + add];
      if (sub >= 0) acc -= mask[row + sub];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) if (k >= 0 && k < h) acc += tmp[k * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc;
      const add = y + r + 1;
      const sub = y - r;
      if (add < h) acc += tmp[add * w + x];
      if (sub >= 0) acc -= tmp[sub * w + x];
    }
  }
  return out;
}

/** Morphological erosion with a square structuring element (pixels outside the image count as unset). */
export function erode(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r < 1) return mask.slice();
  const counts = windowCount(mask, w, h, r);
  const full = (2 * r + 1) * (2 * r + 1);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = counts[i] === full ? 1 : 0;
  return out;
}

/** Morphological dilation with a square structuring element. */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r < 1) return mask.slice();
  const counts = windowCount(mask, w, h, r);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = counts[i] > 0 ? 1 : 0;
  return out;
}

/** Area-average downsampling by an integer factor. */
export function downsample(src: Float32Array, w: number, h: number, factor: number): Plane {
  const f = Math.max(1, Math.floor(factor));
  const ow = Math.max(1, Math.floor(w / f));
  const oh = Math.max(1, Math.floor(h / f));
  const out = new Float32Array(ow * oh);
  const norm = 1 / (f * f);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let acc = 0;
      for (let dy = 0; dy < f; dy++) {
        const row = (y * f + dy) * w + x * f;
        for (let dx = 0; dx < f; dx++) acc += src[row + dx];
      }
      out[y * ow + x] = acc * norm;
    }
  }
  return { data: out, width: ow, height: oh };
}

/** Downsample a mask by an integer factor; a block is set only if all its pixels are set. */
export function downsampleMask(mask: Uint8Array, w: number, h: number, factor: number): Uint8Array {
  const f = Math.max(1, Math.floor(factor));
  const ow = Math.max(1, Math.floor(w / f));
  const oh = Math.max(1, Math.floor(h / f));
  const out = new Uint8Array(ow * oh);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let all = 1;
      for (let dy = 0; dy < f && all; dy++) {
        const row = (y * f + dy) * w + x * f;
        for (let dx = 0; dx < f; dx++) {
          if (!mask[row + dx]) {
            all = 0;
            break;
          }
        }
      }
      out[y * ow + x] = all;
    }
  }
  return out;
}

/** Element-wise a - b. */
export function subtract(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

/** Gradient magnitude with the Sobel operator (borders are zero). */
export function sobelMagnitude(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = src[i - w - 1];
      const t = src[i - w];
      const tr = src[i - w + 1];
      const l = src[i - 1];
      const r = src[i + 1];
      const bl = src[i + w - 1];
      const b = src[i + w];
      const br = src[i + w + 1];
      const gx = tr + 2 * r + br - tl - 2 * l - bl;
      const gy = bl + 2 * b + br - tl - 2 * t - tr;
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

/**
 * Noise standard deviation estimate (Immerkær, 1996: "Fast noise variance
 * estimation"), restricted to masked pixels. The operator cancels smooth
 * image structure so mostly sensor/compression noise remains.
 */
export function estimateNoiseSigma(src: Float32Array, mask: Uint8Array, w: number, h: number): number {
  let sum = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const v =
        src[i - w - 1] - 2 * src[i - w] + src[i - w + 1] -
        2 * src[i - 1] + 4 * src[i] - 2 * src[i + 1] +
        src[i + w - 1] - 2 * src[i + w] + src[i + w + 1];
      sum += Math.abs(v);
      count++;
    }
  }
  if (count === 0) return 0;
  return (Math.sqrt(Math.PI / 2) * sum) / (6 * count);
}

function gaussian1d(sigma: number): Float64Array {
  const r = Math.max(1, Math.ceil(sigma * 4));
  const k = new Float64Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) {
    k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
    s += k[i + r];
  }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return k;
}

/**
 * Variance gain of a 2-D difference-of-Gaussians filter (sigma1 < sigma2) for
 * white noise: band-pass noise variance = gain × pixel noise variance.
 * Used to subtract the camera-noise contribution from texture measurements.
 */
export function dogNoiseGain(sigma1: number, sigma2: number): number {
  const g1 = gaussian1d(sigma1);
  const g2 = gaussian1d(sigma2);
  const r1 = (g1.length - 1) / 2;
  const r2 = (g2.length - 1) / 2;
  let e1 = 0;
  let e2 = 0;
  let cross = 0;
  for (let i = 0; i < g1.length; i++) e1 += g1[i] * g1[i];
  for (let i = 0; i < g2.length; i++) e2 += g2[i] * g2[i];
  for (let i = -r1; i <= r1; i++) if (Math.abs(i) <= r2) cross += g1[i + r1] * g2[i + r2];
  return e1 * e1 + e2 * e2 - 2 * cross * cross;
}
