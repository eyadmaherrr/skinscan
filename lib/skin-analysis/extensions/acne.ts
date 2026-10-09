import type { AlignedFace } from '../alignment';
import type { RgbImage } from '../image/decode';
import { gaussianBlur } from '../image/filters';
import { detectSpots, type Spot } from '../metrics/blemishes';
import { hessianRatio } from '../metrics/blobs';
import { union, type MetricContext } from '../metrics/common';
import { regionGroup } from '../explain';
import { analysisText, type RegionGroup } from '../text';
import type { AcneReport, AcneSeverity, LesionCandidate, RegionCount, RegionKey } from '../types';
import { combineSeverity } from './acne-grade';
import { cropToSourceScale, round4, toNormalized } from './projection';

/**
 * Acne-related spot candidates (heuristic, experimental).
 *
 * Reuses the spots already found by the blemish metric (forehead, nose,
 * cheeks, chin) and runs the same detector on the jawline. Each candidate is
 * a 1.5–5 mm spot that is redder ("red-toned", the look of active blemishes)
 * or darker ("dark-toned", the look of marks, freckles or moles) than the
 * skin around it. The detector is not trained on acne and cannot tell lesion
 * types apart, so counts are approximate and labelled as candidates.
 *
 * Skin folds (smile lines, creases) are shaded *lines* that can trigger a
 * spot detector. Candidates are therefore kept only when their local shape
 * is blob-like: the two eigenvalues of the Hessian of the darkness (or
 * redness) map at the spot's scale must be of similar size; a fold gives one
 * large and one near-zero eigenvalue.
 */

const SUMMARY_REGIONS: RegionKey[] = ['forehead', 'nose', 'cheekL', 'cheekR', 'chin', 'jawL', 'jawR'];
const MIN_VISIBLE = 0.3;
const MAX_LESIONS = 150;
/** Minimum ratio of the smaller to the larger Hessian eigenvalue for a round spot. */
const MIN_BLOBNESS = 0.3;

/**
 * Blob-likeness of a spot: Hessian eigenvalue ratio of L* (dark spots) or a*
 * (red spots), smoothed at the spot's scale, on a small window around it.
 */
export function blobness(face: AlignedFace, s: Spot): number {
  const plane = s.tone === 'dark' ? face.lab.L : face.lab.a;
  const sign = s.tone === 'dark' ? 1 : -1; // dark spot = local minimum of L*, red spot = local maximum of a*
  const r = Math.ceil(4 * s.sigma) + 2;
  const x0 = Math.max(0, s.x - r);
  const y0 = Math.max(0, s.y - r);
  const x1 = Math.min(face.width - 1, s.x + r);
  const y1 = Math.min(face.height - 1, s.y + r);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w < 5 || h < 5) return 0;
  const patch = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) patch[y * w + x] = sign * plane[(y0 + y) * face.width + x0 + x];
  return hessianRatio(gaussianBlur(patch, w, h, s.sigma), w, h, s.x - x0, s.y - y0);
}

export function buildAcneReport(ctx: MetricContext, image: RgbImage, classifier: AcneSeverity): AcneReport {
  const { face, masks } = ctx;
  const detected: Spot[] = [...(ctx.spots ?? [])];
  const jawVisible = (['jawL', 'jawR'] as const).filter((k) => masks.coverage[k] >= MIN_VISIBLE);
  if (jawVisible.length) {
    const jawMasks = Object.fromEntries(jawVisible.map((k) => [k, masks.regions[k]])) as Partial<Record<RegionKey, Uint8Array>>;
    detected.push(...detectSpots(face, union(jawMasks as Record<RegionKey, Uint8Array>, jawVisible), jawMasks));
  }
  const spots = detected.filter((s) => blobness(face, s) >= MIN_BLOBNESS);

  const scale = cropToSourceScale(face);
  const lesions: LesionCandidate[] = spots
    .slice()
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_LESIONS)
    .map((s) => {
      const [x, y] = toNormalized(face, image, s.x, s.y);
      return { x, y, r: round4((1.4 * s.sigma * scale) / image.width), tone: s.tone, region: s.region };
    });

  const regionalSummary: Partial<Record<RegionKey, RegionCount>> = {};
  for (const k of SUMMARY_REGIONS) {
    const visible = masks.coverage[k] >= MIN_VISIBLE;
    regionalSummary[k] = { count: visible ? spots.filter((s) => s.region === k).length : 0, visible };
  }
  const red = spots.filter((s) => s.tone === 'red').length;
  const dark = spots.length - red;
  const text = analysisText(ctx.locale);
  const severity = combineSeverity({ redCount: red, classifier, factors: ctx.quality.factors, locale: ctx.locale });

  let explanation: string;
  if (spots.length === 0) {
    explanation = text.acne.none;
  } else {
    const groups = new Map<RegionGroup, number>();
    for (const s of spots) if (s.region) groups.set(regionGroup(s.region), (groups.get(regionGroup(s.region)) ?? 0) + 1);
    const top = [...groups.entries()].sort((a, b) => b[1] - a[1])[0];
    const tones = red > dark ? text.acne.mostRed : dark > red ? text.acne.mostDark : text.acne.mixed;
    explanation = text.acne.summary(tones, top ? text.regions[top[0]] : null);
  }
  const hidden = SUMMARY_REGIONS.filter((k) => !regionalSummary[k]?.visible);
  const limitations = [...text.acne.limitations];
  if (hidden.some((k) => k === 'jawL' || k === 'jawR')) limitations.push(text.acne.jawHidden);

  return {
    status: 'ok',
    method: 'heuristic_spot_detection',
    lesionCandidateCount: spots.length,
    redToneCount: red,
    darkToneCount: dark,
    lesions,
    regionalSummary,
    severity,
    explanation,
    limitations,
  };
}
