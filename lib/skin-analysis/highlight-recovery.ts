import type { AlignedFace } from './alignment';
import { SRGB_TO_LINEAR } from './image/color';
import { maskedGaussianBlur } from './image/filters';
import { median } from './image/stats';
import type { FaceRegions } from './regions';

/**
 * Recovery of skin pixels whose red channel is clipped.
 *
 * Skin reflects more red than green or blue, so in a bright photo of lighter
 * skin, or under warm indoor light, the red channel reaches the top of its
 * range on the forehead and cheeks while green and blue are still well inside
 * theirs. Those pixels are not overexposed: their brightness and texture are
 * intact, only the red value is capped, which makes them look less red and
 * less saturated than they are. Left as they are they lower the redness
 * baseline and pass for shine; dropped, they can remove most of the skin.
 *
 * The red value is therefore estimated from the green value and the red:green
 * ratio of the unclipped skin around it (skin colour changes slowly across
 * the face), and never set below the clipped value. This is the standard
 * highlight-reconstruction step of raw photo developers. A pixel whose second
 * channel is clipped too is blown out and is not recovered. How much skin was
 * recovered is reported, lowers the exposure confidence, and above a limit
 * the photo is rejected as too bright.
 */

/** Red value (8-bit) treated as clipped. */
export const CLIP_LEVEL = 250;
/** Above this, a second channel is (nearly) clipped as well and colour cannot be recovered. */
const SECOND_CHANNEL_LIMIT = 240;
/** Reference skin must be clearly below the clipping shoulder. */
const REFERENCE_MAX = 240;
/** Distances (mm) over which the local skin colour is estimated. */
const LOCAL_SIGMA_MM = 4;
const WIDE_SIGMA_MM = 15;
/** Upper bound on the estimate, relative to the clipped value (guards against odd ratios). */
const MAX_RECOVERY = 2;

export interface HighlightRecovery {
  /** Linear red value for recovered pixels, NaN elsewhere. */
  redLinear: Float32Array;
  /** 1 where the red channel was clipped and has been estimated. */
  recovered: Uint8Array;
  /** Number of recovered pixels. */
  count: number;
}

/** True when a pixel's red channel is clipped but the other two are not. */
export function isRedOnlyClipped(rgb: Uint8Array, i: number): boolean {
  const r = rgb[i * 3];
  const g = rgb[i * 3 + 1];
  const b = rgb[i * 3 + 2];
  return r >= CLIP_LEVEL && g < SECOND_CHANNEL_LIMIT && b < SECOND_CHANNEL_LIMIT;
}

/**
 * Red value of a pixel from its green and blue values, given the local
 * diffuse skin colour (refR, refG, refB). Skin is modelled as a diffuse part
 * with the skin's own colour plus a surface reflection with the colour of the
 * light (dichromatic reflection model, Shafer 1985), here taken as neutral:
 *   G = k·refG + s,  B = k·refB + s,  R = k·refR + s.
 * Green and blue give k (how brightly the skin is lit) and s (how much light
 * the surface reflects); a shiny highlight therefore keeps its whitish
 * colour instead of being painted the colour of the skin around it.
 */
export function estimateRed(G: number, B: number, refR: number, refG: number, refB: number): number {
  const spread = refG - refB;
  if (spread > 0.05 * refG) {
    const k = (G - B) / spread;
    const s = G - k * refG;
    if (k > 0 && s >= 0) return k * refR + s;
  }
  // Too little colour to separate the two parts, or no surface reflection: scale the skin colour.
  return refG > 1e-4 ? (G * refR) / refG : G;
}

export function recoverClippedRed(face: AlignedFace, regions: FaceRegions): HighlightRecovery {
  const { width: w, height: h, rgb, valid } = face;
  const n = w * h;
  const redLinear = new Float32Array(n).fill(Number.NaN);
  const recovered = new Uint8Array(n);
  const skin = new Uint8Array(n);
  const reference = new Uint8Array(n);
  let candidates = 0;
  let references = 0;
  for (let i = 0; i < n; i++) {
    if (!valid[i] || !regions.faceOval[i] || regions.features[i]) continue;
    skin[i] = 1;
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    if (isRedOnlyClipped(rgb, i)) candidates++;
    else if (r < REFERENCE_MAX && g < REFERENCE_MAX && b < REFERENCE_MAX && g > 20 && r >= g) {
      reference[i] = 1;
      references++;
    }
  }
  if (candidates === 0 || references < 200) return { redLinear, recovered, count: 0 };

  const R = new Float32Array(n);
  const G = new Float32Array(n);
  const B = new Float32Array(n);
  const rg: number[] = [];
  const bg: number[] = [];
  for (let i = 0; i < n; i++) {
    R[i] = SRGB_TO_LINEAR[rgb[i * 3]];
    G[i] = SRGB_TO_LINEAR[rgb[i * 3 + 1]];
    B[i] = SRGB_TO_LINEAR[rgb[i * 3 + 2]];
    if (reference[i] && (i & 7) === 0) {
      rg.push(R[i] / G[i]);
      bg.push(B[i] / G[i]);
    }
  }
  const p = face.pxPerMm;
  // Local diffuse skin colour; a wide estimate (then the face-wide median) fills in where a
  // clipped area is too large to have unclipped skin nearby.
  const blur = (plane: Float32Array, fill: number) => {
    const wide = maskedGaussianBlur(plane, reference, w, h, WIDE_SIGMA_MM * p, new Float32Array(n).fill(fill));
    return maskedGaussianBlur(plane, reference, w, h, LOCAL_SIGMA_MM * p, wide);
  };
  const refR = blur(R, median(Float32Array.from(rg)));
  const refG = blur(G, 1);
  const refB = blur(B, median(Float32Array.from(bg)));

  let count = 0;
  for (let i = 0; i < n; i++) {
    if (!skin[i] || !isRedOnlyClipped(rgb, i)) continue;
    const clippedValue = R[i];
    const estimate = estimateRed(G[i], B[i], refR[i], refG[i], refB[i]);
    redLinear[i] = Math.min(clippedValue * MAX_RECOVERY, Math.max(clippedValue, estimate));
    recovered[i] = 1;
    count++;
  }
  return { redLinear, recovered, count };
}
