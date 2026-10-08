import { dogNoiseGain, erode, estimateNoiseSigma, gaussianBlur } from './filters';
import { maskedValues, quantiles } from './stats';

export interface BandContrast {
  /** Robust amplitude of the band-pass signal (log units ≈ relative contrast). */
  measured: number;
  /** Expected contribution of camera noise to that amplitude. */
  noise: number;
  /** Measured amplitude with the noise contribution removed. */
  corrected: number;
  /** Number of pixels measured. */
  values: number;
  band: Float32Array;
}

/**
 * Fine-detail amplitude of log luminance between two scales (difference of
 * Gaussians), measured robustly (IQR/1.349) inside `mask`, with the camera
 * noise contribution subtracted. Log luminance makes this relative (Weber)
 * contrast, which does not depend on skin reflectance; subtracting noise
 * matters because, in log units, noise is larger on darker skin and in dim
 * light.
 */
export function bandContrast(
  logY: Float32Array,
  mask: Uint8Array,
  w: number,
  h: number,
  sigma1: number,
  sigma2: number,
): BandContrast {
  const a = gaussianBlur(logY, w, h, sigma1);
  const b = gaussianBlur(logY, w, h, sigma2);
  const band = new Float32Array(logY.length);
  for (let i = 0; i < band.length; i++) band[i] = a[i] - b[i];
  const inner = erode(mask, w, h, Math.ceil(sigma2 * 2));
  const use = inner.some((v) => v) ? inner : mask;
  const values = maskedValues(band, use);
  if (values.length === 0) return { measured: 0, noise: 0, corrected: 0, values: 0, band };
  const [q25, q75] = quantiles(values, [0.25, 0.75]);
  const measured = (q75 - q25) / 1.349;
  const noise = Math.sqrt(dogNoiseGain(sigma1, sigma2)) * estimateNoiseSigma(logY, use, w, h);
  return { measured, noise, corrected: Math.sqrt(Math.max(0, measured * measured - noise * noise)), values: values.length, band };
}
