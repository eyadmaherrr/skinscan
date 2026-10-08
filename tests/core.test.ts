import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { confidenceLabel, metricConfidence, MIN_REPORTABLE } from '../lib/skin-analysis/confidence';
import { polygonMask } from '../lib/skin-analysis/geometry';
import { individualTypologyAngle, rgbToLab } from '../lib/skin-analysis/image/color';
import { sniffImageType } from '../lib/skin-analysis/image/decode';
import { dilate, erode, gaussianBlur } from '../lib/skin-analysis/image/filters';
import { quantiles, robustSpread } from '../lib/skin-analysis/image/stats';
import { dogNoiseGain, type MetricMeasurement } from '../lib/skin-analysis/metrics/common';
import { suppressElongated } from '../lib/skin-analysis/metrics/pigmentation';
import type { QualityFactors } from '../lib/skin-analysis/quality';
import { band, calibrate, CALIBRATION } from '../lib/skin-analysis/scoring';
import { METRIC_KEYS } from '../lib/skin-analysis/types';
import { rateLimit, resetRateLimits } from '../lib/rate-limit';

describe('colour conversion', () => {
  it('maps sRGB white and black to the CIELAB extremes', () => {
    const [L, a, b] = rgbToLab(255, 255, 255);
    assert.ok(Math.abs(L - 100) < 0.05 && Math.abs(a) < 0.05 && Math.abs(b) < 0.05);
    const [L0] = rgbToLab(0, 0, 0);
    assert.ok(Math.abs(L0) < 0.05);
  });

  it('gives red skin a positive a* and a typical skin colour a positive b*', () => {
    assert.ok(rgbToLab(200, 80, 80)[1] > 30);
    assert.ok(rgbToLab(200, 150, 120)[2] > 10);
  });

  it('computes ITA so that lighter skin has a larger angle', () => {
    assert.ok(individualTypologyAngle(70, 15) > individualTypologyAngle(40, 20));
  });
});

describe('scoring', () => {
  it('is monotonic and bounded for every metric', () => {
    for (const key of METRIC_KEYS) {
      const anchors = CALIBRATION[key].anchors;
      let previous = -1;
      for (let raw = anchors[0] - 1; raw <= anchors[4] * 1.5 + 1; raw += (anchors[4] - anchors[0]) / 50) {
        const score = calibrate(key, raw);
        assert.ok(score >= 0 && score <= 100);
        assert.ok(score >= previous, `${key} not monotonic at ${raw}`);
        previous = score;
      }
      assert.equal(calibrate(key, anchors[2]), 50);
    }
  });

  it('assigns bands at 25/50/75', () => {
    assert.equal(band(0), 'minimal');
    assert.equal(band(25), 'mild');
    assert.equal(band(50), 'moderate');
    assert.equal(band(75), 'pronounced');
  });
});

describe('confidence', () => {
  const perfect: QualityFactors = { sharpness: 1, exposure: 1, lighting: 1, pose: 1, resolution: 1, naturalDetail: 1, noise: 1, expression: 1 };
  const poor: QualityFactors = { sharpness: 0, exposure: 0, lighting: 0, pose: 0, resolution: 0, naturalDetail: 0, noise: 0, expression: 0 };
  const measurement = (raw: number | null): MetricMeasurement => ({
    key: 'texture',
    raw,
    regionRaw: {},
    coverage: 1,
    reliability: 0.88,
    details: {},
  });

  it('drops when image quality drops', () => {
    assert.ok(metricConfidence(measurement(2), perfect) > metricConfidence(measurement(2), poor));
  });

  it('never reports a metric that could not be measured', () => {
    assert.ok(metricConfidence(measurement(null), perfect) < MIN_REPORTABLE);
    assert.equal(confidenceLabel(0.2), 'insufficient');
  });
});

describe('image helpers', () => {
  it('recognises image formats by their signature, not their name', () => {
    assert.equal(sniffImageType(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0)), 'jpeg');
    assert.equal(sniffImageType(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'png');
    assert.equal(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
    assert.equal(sniffImageType(new TextEncoder().encode('<svg xmlns=')), null);
    assert.equal(sniffImageType(new TextEncoder().encode('%PDF-1.7')), null);
  });

  it('keeps a constant image constant when blurring (small and large sigma)', () => {
    const img = new Float32Array(40 * 30).fill(7);
    for (const sigma of [1, 6]) {
      const out = gaussianBlur(img, 40, 30, sigma);
      assert.ok(out.every((v) => Math.abs(v - 7) < 1e-4));
    }
  });

  it('erodes and dilates masks', () => {
    const mask = polygonMask(20, 20, [
      [5, 5],
      [15, 5],
      [15, 15],
      [5, 15],
    ]);
    const count = (m: Uint8Array) => m.reduce((s, v) => s + v, 0);
    assert.equal(count(mask), 100);
    assert.equal(count(erode(mask, 20, 20, 1)), 64);
    assert.equal(count(dilate(mask, 20, 20, 1)), 144);
  });

  it('computes robust statistics', () => {
    const values = Float32Array.from([1, 2, 3, 4, 100]);
    assert.equal(quantiles(values, [0.5])[0], 3);
    assert.ok(robustSpread(values).sigma < 3);
  });

  it('has a band-pass noise gain between 0 and 1', () => {
    const g = dogNoiseGain(0.6, 3);
    assert.ok(g > 0 && g < 1);
  });
});

describe('fold suppression', () => {
  it('removes thin lines but keeps round spots', () => {
    const w = 60;
    const h = 60;
    const values = new Float32Array(w * h);
    for (let x = 5; x < 55; x++) values[10 * w + x] = 5; // a line (fold)
    for (let y = 35; y < 43; y++) for (let x = 25; x < 33; x++) values[y * w + x] = 5; // a spot
    suppressElongated(values, w, h, 1.5, 3.5, 10);
    assert.equal(values[10 * w + 30], 0);
    assert.equal(values[38 * w + 28], 5);
  });
});

describe('rate limiting', () => {
  it('allows the configured number of scans per window', () => {
    resetRateLimits();
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) assert.ok(rateLimit('k', 3, 60_000, now + i).allowed);
    const blocked = rateLimit('k', 3, 60_000, now + 10);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds > 0);
    assert.ok(rateLimit('k', 3, 60_000, now + 61_000).allowed);
  });
});
