import type { RgbImage } from '../image/decode';
import { detectSpots, type Spot } from '../metrics/blemishes';
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
 * spot detector; the detector itself discards them (`blobness` in
 * metrics/blemishes.ts), so the candidates listed here are exactly the spots
 * the "visible spots & blemishes" score counts, plus those on the jawline.
 */

const SUMMARY_REGIONS: RegionKey[] = ['forehead', 'nose', 'cheekL', 'cheekR', 'chin', 'jawL', 'jawR'];
const MIN_VISIBLE = 0.3;
const MAX_LESIONS = 150;

export function buildAcneReport(ctx: MetricContext, image: RgbImage, classifier: AcneSeverity): AcneReport {
  const { face, masks } = ctx;
  const spots: Spot[] = [...(ctx.spots ?? [])];
  const jawVisible = (['jawL', 'jawR'] as const).filter((k) => masks.coverage[k] >= MIN_VISIBLE);
  if (jawVisible.length) {
    const jawMasks = Object.fromEntries(jawVisible.map((k) => [k, masks.regions[k]])) as Partial<Record<RegionKey, Uint8Array>>;
    spots.push(...detectSpots(face, union(jawMasks as Record<RegionKey, Uint8Array>, jawVisible), jawMasks));
  }

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
