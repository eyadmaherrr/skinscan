/**
 * White balance from the eye whites.
 *
 * Skin colour in a photo is the skin's own colour times the colour of the
 * light. Under warm indoor light or a pink- or green-tinted camera setting the
 * whole face shifts colour, which raises or lowers redness and spot contrast
 * and hides shine (shine is found as highlights paler than the skin around
 * them). The eye whites reflect all colours almost equally, so their colour
 * shows the colour of the light, whatever the skin tone.
 *
 * They are not perfectly neutral either (slightly yellow or red, and more so
 * with age, sun exposure or irritation), so only a clear cast is corrected:
 * the eye-white colour (CIELAB a*, b*) is compared with the typical value
 * measured on well-balanced reference portraits, differences within the usual
 * spread between people are left alone, and only the excess beyond it is
 * removed. The correction is a per-channel gain in linear light (von Kries),
 * chosen so the eye whites keep their brightness, and it is limited in size.
 */

/** Typical eye-white colour (CIELAB) on the well-balanced reference portraits (median a* 2.8, b* 3.4–9). */
export const REFERENCE_SCLERA_A = 2.5;
export const REFERENCE_SCLERA_B = 5;
/** Differences smaller than this (CIELAB units, per axis) are within the normal spread between people. */
export const DEAD_ZONE = 6;
/** Largest gain applied to any channel, either way. */
const MAX_GAIN = 1.5;

const XN = 0.95047;
const ZN = 1.08883;
const EPS = 216 / 24389;
const KAPPA = 24389 / 27;

const f = (t: number) => (t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116);
const fInv = (u: number) => (u ** 3 > EPS ? u ** 3 : (116 * u - 16) / KAPPA);

function linearToLab([r, g, b]: readonly number[]): [number, number, number] {
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const fy = f(y);
  return [116 * fy - 16, 500 * (f(x / XN) - fy), 200 * (fy - f(z / ZN))];
}

function labToLinear(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const x = XN * fInv(fy + a / 500);
  const y = fInv(fy);
  const z = ZN * fInv(fy - b / 200);
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
}

const softThreshold = (d: number) => Math.sign(d) * Math.max(0, Math.abs(d) - DEAD_ZONE);

export interface WhiteBalance {
  /** Linear-light gains for red, green and blue (all 1 when nothing is corrected). */
  gains: [number, number, number];
  /** Eye-white colour difference from the reference (CIELAB a*, b*). */
  cast: [number, number];
  /** Part of that difference that is corrected. */
  correction: [number, number];
}

const NONE: WhiteBalance = { gains: [1, 1, 1], cast: [0, 0], correction: [0, 0] };

/** `sclera` is the mean linear RGB of the eye whites (NaN when they could not be measured). */
export function whiteBalanceFromSclera(sclera: readonly [number, number, number]): WhiteBalance {
  if (!sclera.every((v) => Number.isFinite(v) && v > 0.005)) return NONE;
  const [L, a, b] = linearToLab(sclera);
  const cast: [number, number] = [a - REFERENCE_SCLERA_A, b - REFERENCE_SCLERA_B];
  const correction: [number, number] = [softThreshold(cast[0]), softThreshold(cast[1])];
  if (correction[0] === 0 && correction[1] === 0) return { ...NONE, cast };
  // Same lightness, colour moved back by the correction.
  const target = labToLinear(L, a - correction[0], b - correction[1]);
  const gains = target.map((t, i) => Math.min(MAX_GAIN, Math.max(1 / MAX_GAIN, t / sclera[i]))) as [number, number, number];
  if (!gains.every(Number.isFinite)) return { ...NONE, cast };
  return { gains, cast, correction };
}
