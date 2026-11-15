import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEAD_ZONE, REFERENCE_SCLERA_A, REFERENCE_SCLERA_B, whiteBalanceFromSclera } from '../lib/skin-analysis/white-balance';

/** Linear RGB of a typical eye white (CIELAB ≈ L 80, a* 2.5, b* 5). */
const NEUTRAL: [number, number, number] = [0.6, 0.55, 0.5];

function lab([r, g, b]: number[]): [number, number, number] {
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

describe('white balance from the eye whites', () => {
  it('leaves eye whites within the usual spread between people alone', () => {
    const wb = whiteBalanceFromSclera(NEUTRAL);
    assert.deepEqual(wb.gains, [1, 1, 1]);
  });

  it('removes a warm cast down to the edge of the normal range, keeping brightness', () => {
    const warm: [number, number, number] = [NEUTRAL[0] * 1.28, NEUTRAL[1], NEUTRAL[2] * 0.6];
    const wb = whiteBalanceFromSclera(warm);
    assert.ok(wb.cast[1] > 15, `warm light reads as yellow: b* cast ${wb.cast[1]}`);
    assert.ok(wb.gains[0] < 1 && wb.gains[2] > 1, 'red lowered, blue raised');
    const before = lab(warm);
    const after = lab(warm.map((v, i) => v * wb.gains[i]));
    assert.ok(Math.abs(after[0] - before[0]) < 0.5, 'lightness kept');
    assert.ok(Math.abs(after[2] - (REFERENCE_SCLERA_B + DEAD_ZONE)) < 1, `b* ends at the edge of the normal range: ${after[2]}`);
  });

  it('removes a pink cast on the a* axis', () => {
    const pink: [number, number, number] = [NEUTRAL[0] * 1.15, NEUTRAL[1] * 0.85, NEUTRAL[2] * 1.15];
    const wb = whiteBalanceFromSclera(pink);
    const after = lab(pink.map((v, i) => v * wb.gains[i]));
    assert.ok(Math.abs(after[1] - (REFERENCE_SCLERA_A + DEAD_ZONE)) < 1.5, `a* ${after[1]}`);
  });

  it('limits the correction and ignores missing eye whites', () => {
    const extreme = whiteBalanceFromSclera([0.9, 0.3, 0.05]);
    for (const g of extreme.gains) assert.ok(g <= 1.5 && g >= 1 / 1.5);
    assert.deepEqual(whiteBalanceFromSclera([Number.NaN, 0.5, 0.5]).gains, [1, 1, 1]);
  });
});
