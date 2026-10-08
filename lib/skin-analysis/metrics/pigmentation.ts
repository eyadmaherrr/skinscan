import type { AlignedFace } from '../alignment';
import { erode, gaussianBlur, maskedGaussianBlur } from '../image/filters';
import { maskedValues, ramp } from '../image/stats';
import type { RegionKey } from '../types';
import { countPixels, perRegionMean, regionCoverage, topFractionMean, union, type MetricContext, type MetricMeasurement } from './common';

/**
 * Uneven pigmentation index.
 *
 * Visible pigmentation makes skin darker *and* relatively more saturated
 * (browner). Lighting and facial shape also make skin darker — but shading
 * scales the CIELAB vector (L*+16, a*, b*) uniformly (all three follow the
 * cube root of the light level), so the ratio chroma / (L*+16) is unchanged
 * by shading and changed by pigment.
 *
 * For each pixel (smoothed at 0.4 mm) the local reference is the skin around
 * it (σ 8 mm, which also removes the person's overall skin tone). The
 * "pigment-equivalent darkening" is
 *
 *     D = (L*ref + 16) · (1 − ρref / ρ),   ρ = C* / (L* + 16)
 *
 * which equals the drop in L* when chroma is unchanged, and is ≈ 0 for pure
 * shading. Pixels whose colour shifts towards red (hue angle decreasing by
 * more than a few degrees) are down-weighted — redness is measured separately.
 * Real shadows are not perfectly neutral (light bouncing between skin
 * surfaces tints them), so pixels near region borders, where the local
 * reference is one-sided, are ignored, and the nose and under-eye areas are
 * excluded (strong 3-D shading; under-eye darkness has its own measure).
 *
 * Folds and creases (smile lines, forehead lines) are shaded *lines*, while
 * pigment forms spots and patches, so connected areas of evidence that are
 * strongly elongated (length ≥ 3.5 × width), or long (≥ 8 mm) but mostly
 * thinner than ~2.5 mm even when curved, are discarded. Smiling still adds
 * folds, so the expression lowers this metric's confidence.
 *
 * Scope: spots and patches up to roughly 1.5 cm. Broader patches cannot be
 * separated from lighting in an uncontrolled photo and are not captured.
 *
 * Unit of `raw`: mean pigment-equivalent darkening beyond a 1 ΔL* tolerance,
 * over the most affected 15% of the analysed skin.
 */

const REGIONS: RegionKey[] = ['forehead', 'cheekL', 'cheekR', 'chin'];
const TOLERANCE = 1;
const REF_SIGMA_MM = 8;

/** Per-pixel pigment-equivalent darkening (ΔL* units). */
export function pigmentEvidence(face: AlignedFace, mask: Uint8Array): Float32Array {
  const { width: w, height: h, lab } = face;
  const p = face.pxPerMm;
  const L = maskedGaussianBlur(lab.L, mask, w, h, 0.4 * p);
  const a = maskedGaussianBlur(lab.a, mask, w, h, 0.4 * p);
  const b = maskedGaussianBlur(lab.b, mask, w, h, 0.4 * p);
  const Lr = maskedGaussianBlur(lab.L, mask, w, h, REF_SIGMA_MM * p);
  const ar = maskedGaussianBlur(lab.a, mask, w, h, REF_SIGMA_MM * p);
  const br = maskedGaussianBlur(lab.b, mask, w, h, REF_SIGMA_MM * p);
  const maskF = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) maskF[i] = mask[i];
  const support = gaussianBlur(maskF, w, h, REF_SIGMA_MM * p);
  const out = new Float32Array(L.length);
  for (let i = 0; i < out.length; i++) {
    if (!mask[i] || support[i] < 0.6) continue;
    const rho = Math.hypot(a[i], b[i]) / Math.max(1, L[i] + 16);
    const rhoRef = Math.hypot(ar[i], br[i]) / Math.max(1, Lr[i] + 16);
    if (rho <= 0) continue;
    const d = (Lr[i] + 16) * (1 - rhoRef / rho);
    if (d <= 0) continue;
    const hue = (Math.atan2(b[i], a[i]) * 180) / Math.PI;
    const hueRef = (Math.atan2(br[i], ar[i]) * 180) / Math.PI;
    const notRed = ramp(-6, -2, hue - hueRef);
    // Require some real darkening as well, so a pure saturation change is not counted.
    const darker = ramp(0, 2, Lr[i] - L[i]);
    out[i] = d * notRed * darker * ramp(0.6, 0.85, support[i]);
  }
  suppressElongated(out, w, h, 1.5, 3.5, 3 * p, { erodeRadius: Math.max(1, Math.round(1.25 * p)), minExtent: 8 * p, maxCoreFraction: 0.2 });
  return out;
}

/**
 * Zero out connected components (evidence > threshold, 8-connected) whose
 * principal-axis ratio exceeds `maxElongation` and whose length exceeds
 * `minLength` pixels — the signature of a shaded fold rather than pigment.
 */
export function suppressElongated(
  values: Float32Array,
  w: number,
  h: number,
  threshold: number,
  maxElongation: number,
  minLength: number,
  thin?: { erodeRadius: number; minExtent: number; maxCoreFraction: number },
): void {
  const label = new Int32Array(values.length).fill(-1);
  // "Core" pixels survive an erosion: a thin (fold-like) component has few of them.
  let core: Uint8Array | null = null;
  if (thin) {
    const binary = new Uint8Array(values.length);
    for (let i = 0; i < values.length; i++) binary[i] = values[i] > threshold ? 1 : 0;
    core = erode(binary, w, h, thin.erodeRadius);
  }
  const stack: number[] = [];
  const members: number[] = [];
  for (let start = 0; start < values.length; start++) {
    if (values[start] <= threshold || label[start] !== -1) continue;
    members.length = 0;
    stack.push(start);
    label[start] = start;
    let sx = 0;
    let sy = 0;
    while (stack.length) {
      const i = stack.pop() as number;
      members.push(i);
      const x = i % w;
      const y = (i - x) / w;
      sx += x;
      sy += y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (label[j] === -1 && values[j] > threshold) {
            label[j] = start;
            stack.push(j);
          }
        }
      }
    }
    if (members.length < 6) continue;
    if (thin && core) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let coreCount = 0;
      for (const i of members) {
        const x = i % w;
        const y = (i - x) / w;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (core[i]) coreCount++;
      }
      if (Math.max(maxX - minX, maxY - minY) >= thin.minExtent && coreCount / members.length < thin.maxCoreFraction) {
        for (const i of members) values[i] = 0;
        continue;
      }
    }
    const mx = sx / members.length;
    const my = sy / members.length;
    let cxx = 0;
    let cyy = 0;
    let cxy = 0;
    for (const i of members) {
      const x = (i % w) - mx;
      const y = Math.floor(i / w) - my;
      cxx += x * x;
      cyy += y * y;
      cxy += x * y;
    }
    cxx /= members.length;
    cyy /= members.length;
    cxy /= members.length;
    const tr = cxx + cyy;
    const disc = Math.sqrt(Math.max(0, ((cxx - cyy) * (cxx - cyy)) / 4 + cxy * cxy));
    const major = Math.sqrt(Math.max(1e-6, tr / 2 + disc));
    const minor = Math.sqrt(Math.max(1e-6, tr / 2 - disc));
    if (major / minor >= maxElongation && 4 * major >= minLength) {
      for (const i of members) values[i] = 0;
    }
  }
}

export function measurePigmentation(ctx: MetricContext): MetricMeasurement {
  const { face, masks } = ctx;
  const mask = union(masks.regions, REGIONS);
  const coverage = regionCoverage(masks, REGIONS);
  if (countPixels(mask) < 500) {
    return { key: 'pigmentation', raw: null, regionRaw: {}, coverage, reliability: 0, insufficientReason: 'not_enough_skin', details: {} };
  }
  const evidence = pigmentEvidence(face, masks.all);
  const excess = new Float32Array(evidence.length);
  let sum = 0;
  let spots = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const v = Math.min(15, Math.max(0, evidence[i] - TOLERANCE));
    excess[i] = v;
    sum += v;
    if (evidence[i] > 3) spots++;
    n++;
  }
  return {
    key: 'pigmentation',
    raw: topFractionMean(maskedValues(excess, mask), 0.15),
    regionRaw: perRegionMean(excess, masks.regions, REGIONS),
    coverage,
    reliability: 0.85,
    details: { darkAreaFraction: spots / n, meanExcess: sum / n },
  };
}
