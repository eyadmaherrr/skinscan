import type { MetricMeasurement } from './metrics/common';
import type { Locale } from '../i18n';
import { analysisText, type AnalysisText, type InsufficientReason, type RegionGroup } from './text';
import type { RegionKey, ScoreBand } from './types';

/**
 * Plain-language explanations (English or Arabic, see text.ts). Wording
 * describes what is *visible in the photo* and never names a condition or
 * implies a diagnosis.
 */

/** Merge left/right regions into the groups used in sentences. */
export function regionGroup(region: RegionKey): RegionGroup {
  if (region === 'cheekL' || region === 'cheekR') return 'cheeks';
  if (region === 'underEyeL' || region === 'underEyeR') return 'underEyes';
  if (region === 'jawL' || region === 'jawR') return 'jawline';
  return region;
}

export function formatRegions(regions: RegionKey[], locale: Locale = 'en'): string {
  const text = analysisText(locale);
  const names = Array.from(new Set(regions.map(regionGroup))).map((r) => text.regions[r]);
  return names.length ? text.joinList(names) : text.analysedSkin;
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

function tone(m: MetricMeasurement, text: AnalysisText): string {
  const red = m.details.redCount ?? 0;
  const dark = m.details.darkCount ?? 0;
  if (red + dark < 3) return '';
  if (red >= 2 * dark) return text.mostlyRed;
  if (dark >= 2 * red) return text.mostlyDark;
  return '';
}

function undertone(m: MetricMeasurement, text: AnalysisText): string {
  const dB = m.details.deltaB;
  if (dB === undefined) return '';
  if (dB < -2) return text.cooler;
  if (dB > 2) return text.warmer;
  return '';
}

export function explain(
  m: MetricMeasurement,
  score: number | null,
  scoreBand: ScoreBand | null,
  regions: RegionKey[],
  locale: Locale = 'en',
): string {
  const text = analysisText(locale);
  if (score === null || scoreBand === null) {
    const reason = (m.insufficientReason ?? 'low_confidence') as InsufficientReason;
    return text.insufficient[reason] ?? text.insufficient.low_confidence;
  }
  const qualifier = m.key === 'blemishes' ? tone(m, text) : m.key === 'underEye' ? undertone(m, text) : '';
  let sentence = text.templates[m.key][scoreBand](formatRegions(regions, locale), qualifier);
  if (m.key === 'shine') sentence += text.shineNote;
  if (m.key === 'underEye' && scoreBand !== 'minimal') sentence += text.underEyeNote;
  return sentence;
}
