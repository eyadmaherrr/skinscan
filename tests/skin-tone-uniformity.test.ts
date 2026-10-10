import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AlignedFace } from '../lib/skin-analysis/alignment';
import {
  analyzeSkinToneUniformity,
  computeITA,
  computeRobustQuantiles,
  deltaE76,
  determineFitzpatrick,
  determineUndertone,
  matchMonkScale,
  MONK_SCALE_TONES,
  UNIFORMITY_METHODOLOGY_VERSION,
} from '../lib/skin-analysis/extensions/skin-tone-uniformity';
import type { MetricContext } from '../lib/skin-analysis/metrics/common';
import type { QualityAssessment } from '../lib/skin-analysis/quality';

function makeMockFaceAndContext(options?: {
  baselineL?: number;
  baselineA?: number;
  baselineB?: number;
  mottled?: boolean;
  directionalLight?: boolean;
  withHighlightsAndShadows?: boolean;
}): { ctx: MetricContext; image: { data: Uint8Array; width: number; height: number } } {
  const size = 120;
  const n = size * size;
  const baseL = options?.baselineL ?? 65;
  const baseA = options?.baselineA ?? 14;
  const baseB = options?.baselineB ?? 18;

  const rgb = new Uint8Array(n * 3);
  const lab = {
    L: new Float32Array(n).fill(baseL),
    a: new Float32Array(n).fill(baseA),
    b: new Float32Array(n).fill(baseB),
    Y: new Float32Array(n).fill(0.4),
    logY: new Float32Array(n).fill(Math.log(0.4)),
  };

  const foreheadMask = new Uint8Array(n);
  const noseMask = new Uint8Array(n);
  const cheekLMask = new Uint8Array(n);
  const cheekRMask = new Uint8Array(n);
  const chinMask = new Uint8Array(n);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      // Forehead
      if (y >= 10 && y < 40 && x >= 20 && x < 100) foreheadMask[idx] = 1;
      // Nose
      else if (y >= 40 && y < 75 && x >= 45 && x < 75) noseMask[idx] = 1;
      // Cheek L
      else if (y >= 40 && y < 85 && x >= 15 && x < 45) cheekLMask[idx] = 1;
      // Cheek R
      else if (y >= 40 && y < 85 && x >= 75 && x < 105) cheekRMask[idx] = 1;
      // Chin
      else if (y >= 85 && y < 110 && x >= 35 && x < 85) chinMask[idx] = 1;

      // Base skin pixel RGB
      rgb[idx * 3] = 205;
      rgb[idx * 3 + 1] = 165;
      rgb[idx * 3 + 2] = 135;
    }
  }

  // If mottled, add noticeable variation to forehead and chin
  if (options?.mottled) {
    for (let i = 0; i < n; i++) {
      if (foreheadMask[i]) {
        lab.L[i] = baseL - 12; // Noticeably darker
        lab.a[i] = baseA + 8; // Noticeably redder
        lab.b[i] = baseB - 6;
      } else if (chinMask[i]) {
        lab.L[i] = baseL + 10; // Noticeably lighter
        lab.a[i] = baseA - 7;
        lab.b[i] = baseB + 9;
      }
    }
  }

  // If directional lighting, simulate side-lit cheek asymmetry
  if (options?.directionalLight) {
    for (let i = 0; i < n; i++) {
      if (cheekLMask[i]) {
        lab.L[i] = baseL + 10; // Lit side
      } else if (cheekRMask[i]) {
        lab.L[i] = baseL - 10; // Shadowed side (Delta L* = 20 > 14)
      }
    }
  }

  // If highlights and shadows, add clipped specular pixels and deep shadow pixels
  if (options?.withHighlightsAndShadows) {
    for (let y = 12; y < 18; y++) {
      for (let x = 40; x < 60; x++) {
        const idx = y * size + x;
        // Specular highlight: clipped
        rgb[idx * 3] = 250;
        rgb[idx * 3 + 1] = 250;
        rgb[idx * 3 + 2] = 250;
        lab.L[idx] = 98;
      }
    }
    for (let y = 30; y < 35; y++) {
      for (let x = 25; x < 35; x++) {
        const idx = y * size + x;
        // Deep shadow: occluded
        rgb[idx * 3] = 15;
        rgb[idx * 3 + 1] = 10;
        rgb[idx * 3 + 2] = 10;
        lab.L[idx] = 8;
      }
    }
  }

  const emptyMask = new Uint8Array(n);
  const regionMap = {
    forehead: foreheadMask,
    nose: noseMask,
    cheekL: cheekLMask,
    cheekR: cheekRMask,
    chin: chinMask,
    underEyeL: emptyMask,
    underEyeR: emptyMask,
    jawL: emptyMask,
    jawR: emptyMask,
  };

  const face: AlignedFace = {
    width: size,
    height: size,
    rgb,
    valid: new Uint8Array(n).fill(1),
    lab,
    pxPerMm: 4,
    sourceIod: 75,
    landmarks: new Float32Array(478 * 2),
    sourceCenter: [size / 2, size / 2],
    sourceScale: 1,
    sourceRotation: 0,
  } as unknown as AlignedFace;

  const masks = {
    skin: new Uint8Array(n).fill(1),
    usable: new Uint8Array(n).fill(1),
    usableNonSpecular: new Uint8Array(n).fill(1),
    all: new Uint8Array(n).fill(1),
    allWithHighlights: new Uint8Array(n).fill(1),
    geometric: regionMap as any,
    regions: regionMap,
    regionsWithHighlights: regionMap,
    coverage: {
      forehead: 0.9,
      nose: 0.9,
      cheekL: 0.9,
      cheekR: 0.9,
      chin: 0.9,
      underEyeL: 0,
      underEyeR: 0,
      jawL: 0,
      jawR: 0,
    },
  };

  const quality: QualityAssessment = {
    factors: {
      sharpness: 0.9,
      exposure: 0.9,
      lighting: 0.9,
      pose: 0.95,
      resolution: 0.9,
      naturalDetail: 0.85,
      noise: 0.9,
      expression: 0.95,
    },
    issues: [],
    notes: [],
    diagnostics: {} as any,
  };

  const ctx: MetricContext = {
    face,
    masks,
    quality,
    cache: new Map(),
    locale: 'en',
  };

  const image = {
    data: rgb,
    width: size,
    height: size,
  };

  return { ctx, image };
}

describe('Skin-Tone Uniformity Analysis Engine', () => {
  describe('Mathematical Foundations', () => {
    it('computes exact Euclidean Delta E 1976 distances', () => {
      assert.equal(deltaE76(50, 10, 20, 50, 10, 20), 0);
      // 3-4-5 right triangle in CIELAB space
      assert.equal(deltaE76(50, 0, 0, 50, 3, 4), 5);
      assert.equal(deltaE76(50, 0, 0, 53, 0, 0), 3);
    });

    it('computes robust median and IQR rejecting extreme outliers', () => {
      const values = [10, 12, 14, 15, 16, 18, 20, 1000]; // Outlier 1000
      const { median, iqr } = computeRobustQuantiles(values);
      assert.ok(median >= 14 && median <= 16);
      assert.ok(iqr < 10, `IQR should be resistant to 1000 outlier, got ${iqr}`);
    });
  });

  describe('Uniform vs Mottled Facial Skin', () => {
    it('produces high uniformity score (>= 85) on uniform skin', async () => {
      const { ctx, image } = makeMockFaceAndContext();
      const report = await analyzeSkinToneUniformity(ctx, image, { enabled: true });

      assert.equal(report.status, 'ok');
      assert.equal(report.methodologyVersion, UNIFORMITY_METHODOLOGY_VERSION);
      assert.ok(report.uniformityScore !== null && report.uniformityScore >= 85);
      assert.equal(report.band, 'high');
      assert.ok(report.colorDifferences.meanInterRegionDeltaE !== null);
      assert.ok(report.colorDifferences.meanInterRegionDeltaE < 1.0);
    });

    it('produces significantly lower uniformity score (< 65) on mottled skin', async () => {
      const { ctx, image } = makeMockFaceAndContext({ mottled: true });
      const report = await analyzeSkinToneUniformity(ctx, image, { enabled: true });

      assert.equal(report.status, 'ok');
      assert.ok(report.uniformityScore !== null && report.uniformityScore < 65);
      assert.ok(report.band === 'moderate' || report.band === 'variable');
      assert.ok((report.colorDifferences.meanInterRegionDeltaE ?? 0) > 3.0);
    });
  });

  describe('Tone Fairness across Fitzpatrick Phototypes', () => {
    it('treats dark and light skin tones equitably when color distribution is uniform', async () => {
      // Type I (pale, L*=78)
      const typeI = makeMockFaceAndContext({ baselineL: 78, baselineA: 10, baselineB: 14 });
      const repI = await analyzeSkinToneUniformity(typeI.ctx, typeI.image, { enabled: true });

      // Type III (intermediate, L*=64)
      const typeIII = makeMockFaceAndContext({ baselineL: 64, baselineA: 14, baselineB: 18 });
      const repIII = await analyzeSkinToneUniformity(typeIII.ctx, typeIII.image, { enabled: true });

      // Type VI (dark skin, L*=30)
      const typeVI = makeMockFaceAndContext({ baselineL: 30, baselineA: 8, baselineB: 12 });
      const repVI = await analyzeSkinToneUniformity(typeVI.ctx, typeVI.image, { enabled: true });

      assert.ok(repI.uniformityScore !== null && repI.uniformityScore >= 85);
      assert.ok(repIII.uniformityScore !== null && repIII.uniformityScore >= 85);
      assert.ok(repVI.uniformityScore !== null && repVI.uniformityScore >= 85);

      // Score spread between phototypes on uniformly colored skin must be negligible (<= 5 points)
      const scoreDiff = Math.abs((repI.uniformityScore ?? 0) - (repVI.uniformityScore ?? 0));
      assert.ok(
        scoreDiff <= 5,
        `Tone bias detected: Type I score (${repI.uniformityScore}) vs Type VI score (${repVI.uniformityScore}) diff is ${scoreDiff}`,
      );
    });
  });

  describe('Quality Filtration and Lighting Asymmetry', () => {
    it('filters out clipped highlights and deep occluding shadows from valid pixel count', async () => {
      const { ctx, image } = makeMockFaceAndContext({ withHighlightsAndShadows: true });
      const report = await analyzeSkinToneUniformity(ctx, image, { enabled: true });

      assert.equal(report.status, 'ok');
      assert.ok(report.quality.excludedDueToQualityFraction > 0);
      assert.ok(report.quality.validSkinPixelCount > 0);
    });

    it('detects directional lighting and adds warning when cheek lightness difference > 14', async () => {
      const { ctx, image } = makeMockFaceAndContext({ directionalLight: true });
      const report = await analyzeSkinToneUniformity(ctx, image, { enabled: true });

      assert.equal(report.status, 'ok');
      assert.ok(report.colorDifferences.lightingAsymmetry !== null);
      assert.ok(report.colorDifferences.lightingAsymmetry > 14);
      assert.ok(report.warnings.includes('directional_lighting_detected'));
    });

    it('returns disabled status when enabled: false', async () => {
      const { ctx, image } = makeMockFaceAndContext();
      const report = await analyzeSkinToneUniformity(ctx, image, { enabled: false });

      assert.equal(report.status, 'disabled');
      assert.equal(report.uniformityScore, null);
      assert.equal(report.skinTone, null);
    });
  });

  describe('Sony Research Skin-Tone Extraction', () => {
    it('computes correct Individual Typology Angle (ITA) and maps to Fitzpatrick phototypes', () => {
      // Type I: Very Light (ITA > 55°) -> L*=78, b*=14 -> ITA ~ 63.4°
      const itaI = computeITA(78, 14);
      assert.ok(itaI > 55, `Expected ITA > 55, got ${itaI}`);
      assert.equal(determineFitzpatrick(itaI).type, 'I');

      // Type III: Intermediate (28° < ITA <= 41°) -> L*=65, b*=18 -> ITA ~ 39.8°
      const itaIII = computeITA(65, 18);
      assert.ok(itaIII > 28 && itaIII <= 41, `Expected 28 < ITA <= 41, got ${itaIII}`);
      assert.equal(determineFitzpatrick(itaIII).type, 'III');

      // Type IV: Tan / Olive (10° < ITA <= 28°) -> L*=58, b*=22 -> ITA ~ 20.0°
      const itaIV = computeITA(58, 22);
      assert.ok(itaIV > 10 && itaIV <= 28, `Expected 10 < ITA <= 28, got ${itaIV}`);
      assert.equal(determineFitzpatrick(itaIV).type, 'IV');

      // Type VI: Dark (ITA <= -30°) -> L*=30, b*=12 -> ITA ~ -59.0°
      const itaVI = computeITA(30, 12);
      assert.ok(itaVI <= -30, `Expected ITA <= -30, got ${itaVI}`);
      assert.equal(determineFitzpatrick(itaVI).type, 'VI');
    });

    it('matches nearest Monk Skin Tone (MST 1–10) scale accurately', () => {
      // Nearest to Monk 05 (L=77.3, a=6.5, b=22.8)
      const monkMatch = matchMonkScale(76, 7, 23);
      assert.equal(monkMatch.number, 5);
      assert.equal(monkMatch.name, 'Monk 05');
      assert.equal(monkMatch.hex, '#d7bd96');
      assert.ok(monkMatch.deltaE < 3.0);
    });

    it('determines skin undertones (cool, neutral, warm) from hue angle', () => {
      // Cool: low b/a ratio, pinkish/rosy (a=16, b=12) -> hueAngle ~ 36.9°
      assert.equal(determineUndertone(16, 12).undertone, 'cool');

      // Neutral: balanced (a=14, b=20) -> hueAngle ~ 55°
      assert.equal(determineUndertone(14, 20).undertone, 'neutral');

      // Warm: golden/yellowish (a=10, b=24) -> hueAngle ~ 67.4°
      assert.equal(determineUndertone(10, 24).undertone, 'warm');
    });

    it('extracts complete skinTone profile and regional tone metrics in analysis report', async () => {
      // Create Type III face (L=65, a=14, b=18)
      const { ctx, image } = makeMockFaceAndContext({ baselineL: 65, baselineA: 14, baselineB: 18 });
      const report = await analyzeSkinToneUniformity(ctx, image, { enabled: true });

      assert.equal(report.status, 'ok');
      assert.ok(report.skinTone !== null && report.skinTone !== undefined);
      assert.equal(report.skinTone.fitzpatrick, 'III');
      assert.ok(report.skinTone.ita > 28 && report.skinTone.ita <= 41);
      assert.ok(report.skinTone.hexColor.startsWith('#'));
      assert.ok(report.skinTone.monk.number >= 1 && report.skinTone.monk.number <= 10);
      assert.ok(report.skinTone.undertone);

      // Verify regional metrics include regional ITA and swatches
      assert.ok(report.regionalMetrics.forehead);
      assert.ok(report.regionalMetrics.forehead.ita !== undefined);
      assert.ok(report.regionalMetrics.forehead.hexColor?.startsWith('#'));
      assert.ok(report.regionalMetrics.forehead.statusLabel);
      assert.ok(report.regionalMetrics.cheekLeft?.hexColor?.startsWith('#'));
    });
  });
});


