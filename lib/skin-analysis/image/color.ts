/**
 * Colour-space conversions. All skin colour measurements are made in CIELAB
 * (D65), the space used by dermatological colorimetry (chromameters report
 * L*a*b*): a* tracks visible redness (erythema) while L* and b* track visible
 * pigmentation. Luminance texture measurements use log of linear luminance so
 * they describe relative (Weber) contrast, which does not depend on how light
 * or dark the skin is.
 */

/** sRGB 8-bit value -> linear-light value (0–1). */
export const SRGB_TO_LINEAR = (() => {
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lut[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return lut;
})();

const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;
const EPS = 216 / 24389;
const KAPPA = 24389 / 27;

function labF(t: number): number {
  return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
}

export interface LabImage {
  L: Float32Array;
  a: Float32Array;
  b: Float32Array;
  /** Linear relative luminance, 0–1. */
  Y: Float32Array;
  /** Natural log of linear luminance (floored to avoid -Infinity). */
  logY: Float32Array;
}

/**
 * Convert an interleaved RGB (3 channels) 8-bit buffer to CIELAB + luminance
 * planes. `gain` scales linear light first (exposure normalisation).
 */
export function rgbToLabImage(rgb: Uint8Array, pixelCount: number, gain = 1): LabImage {
  const L = new Float32Array(pixelCount);
  const a = new Float32Array(pixelCount);
  const b = new Float32Array(pixelCount);
  const Y = new Float32Array(pixelCount);
  const logY = new Float32Array(pixelCount);
  for (let i = 0, o = 0; i < pixelCount; i++, o += 3) {
    const r = SRGB_TO_LINEAR[rgb[o]] * gain;
    const g = SRGB_TO_LINEAR[rgb[o + 1]] * gain;
    const bl = SRGB_TO_LINEAR[rgb[o + 2]] * gain;
    const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * bl;
    const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * bl;
    const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * bl;
    const fx = labF(x / XN);
    const fy = labF(y / YN);
    const fz = labF(z / ZN);
    L[i] = 116 * fy - 16;
    a[i] = 500 * (fx - fy);
    b[i] = 200 * (fy - fz);
    Y[i] = y;
    logY[i] = Math.log(Math.max(y, 1e-4));
  }
  return { L, a, b, Y, logY };
}

/** Single-pixel conversion, used by tests and small computations. */
export function rgbToLab(r8: number, g8: number, b8: number): [number, number, number] {
  const img = rgbToLabImage(Uint8Array.of(r8, g8, b8), 1);
  return [img.L[0], img.a[0], img.b[0]];
}

/**
 * Individual Typology Angle (Chardon et al., 1991), in degrees. Higher ITA =
 * lighter skin. Used only for internal fairness evaluation — never shown to
 * the user and never used to change a score.
 */
export function individualTypologyAngle(L: number, b: number): number {
  return (Math.atan2(L - 50, Math.max(b, 1e-3)) * 180) / Math.PI;
}

/** CIELAB chroma. */
export function chroma(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
}

/** CIELAB hue angle in degrees (0–360). */
export function hueAngle(a: number, b: number): number {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}
