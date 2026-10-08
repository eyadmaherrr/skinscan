import type { MetricMeasurement } from './metrics/common';
import type { MetricKey, RegionKey, ScoreBand } from './types';

/**
 * Plain-language explanations. Wording describes what is *visible in the
 * photo* and never names a condition or implies a diagnosis.
 */

const REGION_NAMES: Record<string, string> = {
  forehead: 'forehead',
  nose: 'nose',
  cheeks: 'cheeks',
  chin: 'chin',
  underEyes: 'under-eye area',
};

/** Merge left/right regions into human names. */
export function regionGroup(region: RegionKey): string {
  if (region === 'cheekL' || region === 'cheekR') return 'cheeks';
  if (region === 'underEyeL' || region === 'underEyeR') return 'underEyes';
  return region;
}

export function formatRegions(regions: RegionKey[]): string {
  const names = Array.from(new Set(regions.map(regionGroup))).map((r) => REGION_NAMES[r] ?? r);
  if (names.length === 0) return 'analysed skin';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Regions whose value is close to the highest region value (at most three groups). */
export function prominentRegions(m: MetricMeasurement): RegionKey[] {
  const entries = Object.entries(m.regionRaw) as [RegionKey, number][];
  if (entries.length === 0 || m.raw === null) return [];
  const max = Math.max(...entries.map(([, v]) => v));
  if (max <= 0) return [];
  const picked = entries
    .filter(([, v]) => v >= 0.7 * max)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  const groups: string[] = [];
  return picked.filter((k) => {
    const g = regionGroup(k);
    if (groups.includes(g)) return true;
    if (groups.length >= 3) return false;
    groups.push(g);
    return true;
  });
}

type Templates = Record<ScoreBand, (where: string, m: MetricMeasurement) => string>;

const TEMPLATES: Record<MetricKey, Templates> = {
  pigmentation: {
    minimal: () => 'Skin tone looked even across the analysed areas, with few darker patches.',
    mild: (w) => `A few small areas were slightly darker than the surrounding skin, mainly on the ${w}.`,
    moderate: (w) => `Several areas were visibly darker than the surrounding skin, most noticeably on the ${w}.`,
    pronounced: (w) => `Darker patches were clearly visible against the surrounding skin, especially on the ${w}.`,
  },
  redness: {
    minimal: () => 'Little redness stood out from your overall skin tone.',
    mild: (w) => `Some areas looked slightly redder than the rest of your skin, mainly on the ${w}.`,
    moderate: (w) => `Redness was visible compared with the rest of your skin, most noticeably on the ${w}.`,
    pronounced: (w) => `Redness was clearly visible compared with the rest of your skin, especially on the ${w}.`,
  },
  texture: {
    minimal: () => 'The skin surface looked smooth in this photo.',
    mild: (w) => `Some fine surface texture was visible, mainly on the ${w}.`,
    moderate: (w) => `Surface texture (fine unevenness of the skin) was visible, most noticeably on the ${w}.`,
    pronounced: (w) => `Surface texture was clearly visible across the ${w}.`,
  },
  blemishes: {
    minimal: () => 'Few distinct spots or marks stood out from the surrounding skin.',
    mild: (w, m) => `A few distinct spots were visible${tone(m)}, mainly on the ${w}.`,
    moderate: (w, m) => `Several distinct spots or marks were visible${tone(m)}, most noticeably on the ${w}.`,
    pronounced: (w, m) => `Many distinct spots or marks were visible${tone(m)}, especially on the ${w}.`,
  },
  shine: {
    minimal: () => 'Little surface shine was visible in this lighting.',
    mild: (w) => `Some light shine was visible, mainly on the ${w}.`,
    moderate: (w) => `Noticeable shine was visible, mostly on the ${w}.`,
    pronounced: (w) => `Strong shine was visible, especially on the ${w}.`,
  },
  underEye: {
    minimal: () => 'The under-eye area looked similar in tone to the nearby cheek skin.',
    mild: (_, m) => `The under-eye area looked slightly darker${undertone(m)} than the nearby cheek skin.`,
    moderate: (_, m) => `The under-eye area looked visibly darker${undertone(m)} than the nearby cheek skin.`,
    pronounced: (_, m) => `The under-eye area looked clearly darker${undertone(m)} than the nearby cheek skin.`,
  },
};

function tone(m: MetricMeasurement): string {
  const red = m.details.redCount ?? 0;
  const dark = m.details.darkCount ?? 0;
  if (red + dark < 3) return '';
  if (red >= 2 * dark) return ', mostly red-toned';
  if (dark >= 2 * red) return ', mostly darker-toned';
  return '';
}

function undertone(m: MetricMeasurement): string {
  const dB = m.details.deltaB;
  if (dB === undefined) return '';
  if (dB < -2) return ' and cooler-toned';
  if (dB > 2) return ' and warmer-toned';
  return '';
}

const INSUFFICIENT: Record<string, string> = {
  low_resolution: 'The photo did not have enough detail to measure this reliably. A closer, sharper photo may allow it.',
  not_enough_skin: 'Not enough clear skin was visible in the relevant areas to measure this reliably.',
  not_visible: 'This area was not clearly visible in the photo.',
  low_confidence: 'The photo conditions did not allow a reliable measurement. Brighter, even lighting and a sharp photo may help.',
  expression: 'Smiling creases the cheeks, and those folds look like darker or textured skin. A photo with a relaxed, neutral expression is needed to measure this.',
};

export function explain(m: MetricMeasurement, score: number | null, scoreBand: ScoreBand | null, regions: RegionKey[]): string {
  if (score === null || scoreBand === null) {
    return INSUFFICIENT[m.insufficientReason ?? 'low_confidence'] ?? INSUFFICIENT.low_confidence;
  }
  let text = TEMPLATES[m.key][scoreBand](formatRegions(regions), m);
  if (m.key === 'shine') text += ' Shine depends strongly on the lighting when the photo was taken.';
  if (m.key === 'underEye' && scoreBand !== 'minimal') text += ' Overhead lighting can make this area look darker.';
  return text;
}
