import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localePath, stripLocale } from '../lib/i18n';
import { format, messages } from '../lib/messages';
import { explain, formatRegions } from '../lib/skin-analysis/explain';
import type { MetricMeasurement } from '../lib/skin-analysis/metrics/common';
import { analysisText } from '../lib/skin-analysis/text';
import { METRIC_KEYS, type ScoreBand } from '../lib/skin-analysis/types';

const ARABIC = /[؀-ۿ]/;

/** Paths of every leaf value, so both languages can be compared key by key. */
function shape(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [`${prefix}[${value.length}]`, ...value.flatMap((v, i) => shape(v, `${prefix}[${i}]`))];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => shape(v, `${prefix}.${k}`));
  return [`${prefix}:${typeof value}`];
}

describe('languages', () => {
  it('has every interface text in Arabic', () => {
    assert.deepEqual(shape(messages('ar')), shape(messages('en')));
  });

  it('has every analysis sentence in Arabic', () => {
    assert.deepEqual(shape(analysisText('ar')), shape(analysisText('en')));
  });

  it('keeps placeholders in both languages', () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const en = messages('en');
    const ar = messages('ar');
    const pairs: [string, string][] = [
      [en.photo.consent, ar.photo.consent],
      [en.auth.legal, ar.auth.legal],
      [en.acne.candidates, ar.acne.candidates],
      [en.acne.tones, ar.acne.tones],
      [en.acne.methodGrader, ar.acne.methodGrader],
      [en.report.page, ar.report.page],
      [en.overlay.zoom, ar.overlay.zoom],
    ];
    for (const [a, b] of pairs) assert.equal(placeholders(a), placeholders(b), a);
    assert.equal(format('{n} of {total}', { n: 1, total: 2 }), '1 of 2');
  });

  it('explains every metric and band in Arabic', () => {
    const bands: ScoreBand[] = ['minimal', 'mild', 'moderate', 'pronounced'];
    for (const key of METRIC_KEYS) {
      const m = { key, raw: 1, regionRaw: {}, coverage: 1, reliability: 1, details: { redCount: 5, darkCount: 0, deltaB: 3 } } as MetricMeasurement;
      for (const band of bands) {
        const text = explain(m, 50, band, ['cheekL', 'nose'], 'ar');
        assert.match(text, ARABIC);
        assert.ok(!text.includes('undefined'), text);
      }
      assert.match(explain({ ...m, raw: null, insufficientReason: 'expression' }, null, null, [], 'ar'), ARABIC);
    }
    assert.equal(formatRegions(['forehead', 'nose', 'cheekR'], 'ar'), 'الجبهة والأنف والخدين');
    assert.equal(formatRegions(['forehead', 'nose', 'cheekR'], 'en'), 'forehead, nose and cheeks');
  });

  it('maps paths between languages', () => {
    assert.equal(localePath('/', 'ar'), '/ar');
    assert.equal(localePath('/terms', 'ar'), '/ar/terms');
    assert.equal(localePath('/terms', 'en'), '/terms');
    assert.equal(stripLocale('/ar'), '/');
    assert.equal(stripLocale('/ar/privacy'), '/privacy');
    assert.equal(stripLocale('/arabic'), '/arabic');
  });
});
