import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANATOMICAL_REGION_KEYS_V3,
  FEATURE_KEYS_V3,
} from '../lib/skin-analysis/types-v3';
import { LM } from '../lib/skin-analysis/face-topology';
import type { AlignedFace } from '../lib/skin-analysis/alignment';
import { buildAnatomicalRegionsV3 } from '../lib/skin-analysis/regions-v3';
import { assessRegionQuality, checkFeatureFeasibility } from '../lib/skin-analysis/quality-v3';
import { aggregateV3Analysis } from '../lib/skin-analysis/aggregation-v3';
import { measureRegionFeature, type RegionalMeasurementContext } from '../lib/skin-analysis/features-v3/engine';
import type { QualityAssessment } from '../lib/skin-analysis/quality';

function makeMockAlignedFace(width = 300, height = 300): AlignedFace {
  const n = width * height;
  const xy = new Float32Array(478 * 2);

  // Setup typical facial landmarks with IOD = 80
  // Eyes at (110, 110) and (190, 110)
  xy[LM.eyeInnerImgLeft * 2] = 130; xy[LM.eyeInnerImgLeft * 2 + 1] = 110;
  xy[LM.eyeOuterImgLeft * 2] = 90;  xy[LM.eyeOuterImgLeft * 2 + 1] = 110;
  xy[LM.eyeInnerImgRight * 2] = 170; xy[LM.eyeInnerImgRight * 2 + 1] = 110;
  xy[LM.eyeOuterImgRight * 2] = 210; xy[LM.eyeOuterImgRight * 2 + 1] = 110;

  // Forehead & eyebrows
  xy[LM.foreheadTop * 2] = 150; xy[LM.foreheadTop * 2 + 1] = 40;
  xy[LM.glabella * 2] = 150;    xy[LM.glabella * 2 + 1] = 90;
  xy[LM.leftBrowInner * 2] = 135;  xy[LM.leftBrowInner * 2 + 1] = 95;
  xy[LM.rightBrowInner * 2] = 165; xy[LM.rightBrowInner * 2 + 1] = 95;
  xy[LM.leftBrowOuter * 2] = 85;   xy[LM.leftBrowOuter * 2 + 1] = 95;
  xy[LM.rightBrowOuter * 2] = 215; xy[LM.rightBrowOuter * 2 + 1] = 95;

  // Eyebrow curves
  const browUpperL = [70, 63, 105, 66, 107];
  for (let k = 0; k < browUpperL.length; k++) {
    xy[browUpperL[k] * 2] = 85 + (k / (browUpperL.length - 1)) * 50;
    xy[browUpperL[k] * 2 + 1] = 90;
  }
  const browUpperR = [336, 296, 334, 293, 300];
  for (let k = 0; k < browUpperR.length; k++) {
    xy[browUpperR[k] * 2] = 165 + (k / (browUpperR.length - 1)) * 50;
    xy[browUpperR[k] * 2 + 1] = 90;
  }
  const browLowL = [46, 53, 52, 65, 55];
  for (let k = 0; k < browLowL.length; k++) {
    xy[browLowL[k] * 2] = 85 + (k / (browLowL.length - 1)) * 50;
    xy[browLowL[k] * 2 + 1] = 96;
  }
  const browLowR = [285, 295, 282, 283, 276];
  for (let k = 0; k < browLowR.length; k++) {
    xy[browLowR[k] * 2] = 165 + (k / (browLowR.length - 1)) * 50;
    xy[browLowR[k] * 2 + 1] = 96;
  }

  // Eyelid rings
  const lowerLidL = [33, 7, 163, 144, 145, 153, 154, 155, 133];
  for (let k = 0; k < lowerLidL.length; k++) {
    xy[lowerLidL[k] * 2] = 90 + (k / (lowerLidL.length - 1)) * 40;
    xy[lowerLidL[k] * 2 + 1] = 114;
  }
  const lowerLidR = [362, 382, 381, 380, 374, 373, 390, 249, 263];
  for (let k = 0; k < lowerLidR.length; k++) {
    xy[lowerLidR[k] * 2] = 170 + (k / (lowerLidR.length - 1)) * 40;
    xy[lowerLidR[k] * 2 + 1] = 114;
  }

  const eyeLIndices = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
  for (let k = 0; k < eyeLIndices.length; k++) {
    xy[eyeLIndices[k] * 2] = 90 + (k / eyeLIndices.length) * 40;
    xy[eyeLIndices[k] * 2 + 1] = 110;
  }
  const eyeRIndices = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382];
  for (let k = 0; k < eyeRIndices.length; k++) {
    xy[eyeRIndices[k] * 2] = 170 + (k / eyeRIndices.length) * 40;
    xy[eyeRIndices[k] * 2 + 1] = 110;
  }

  // Nose
  xy[LM.noseBridge * 2] = 150; xy[LM.noseBridge * 2 + 1] = 120;
  xy[LM.infratip * 2] = 150;   xy[LM.infratip * 2 + 1] = 155;
  xy[LM.noseTip * 2] = 150;    xy[LM.noseTip * 2 + 1] = 160;
  xy[LM.subnasale * 2] = 150;  xy[LM.subnasale * 2 + 1] = 170;
  xy[LM.leftAlarBase * 2] = 130;  xy[LM.leftAlarBase * 2 + 1] = 165;
  xy[LM.rightAlarBase * 2] = 170; xy[LM.rightAlarBase * 2 + 1] = 165;

  // Mouth & Perioral
  xy[LM.upperLipTop * 2] = 150; xy[LM.upperLipTop * 2 + 1] = 185;
  xy[LM.upperLipInner * 2] = 150; xy[LM.upperLipInner * 2 + 1] = 192;
  xy[LM.lowerLipInner * 2] = 150; xy[LM.lowerLipInner * 2 + 1] = 198;
  xy[LM.lowerLipBottom * 2] = 150; xy[LM.lowerLipBottom * 2 + 1] = 205;
  xy[LM.mouthCornerImgLeft * 2] = 120; xy[LM.mouthCornerImgLeft * 2 + 1] = 195;
  xy[LM.mouthCornerImgRight * 2] = 180; xy[LM.mouthCornerImgRight * 2 + 1] = 195;

  // Chin & Jawline
  xy[LM.labiomentalCrease * 2] = 150; xy[LM.labiomentalCrease * 2 + 1] = 220;
  xy[LM.chin * 2] = 150; xy[LM.chin * 2 + 1] = 260;
  xy[LM.faceSideImgLeft * 2] = 50; xy[LM.faceSideImgLeft * 2 + 1] = 160;
  xy[LM.faceSideImgRight * 2] = 250; xy[LM.faceSideImgRight * 2 + 1] = 160;

  // Setup generous FACE_OVAL along face perimeter (covers 30..270 in X and 30..280 in Y)
  const ovalIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  for (let k = 0; k < ovalIndices.length; k++) {
    const idx = ovalIndices[k];
    const angle = (k / ovalIndices.length) * 2 * Math.PI - Math.PI / 2;
    xy[idx * 2] = 150 + 115 * Math.cos(angle);
    xy[idx * 2 + 1] = 155 + 120 * Math.sin(angle);
  }

  // Forehead arc across top (indices 54, 103, 67, 109, 10, 338, 297, 332, 284)
  const arcIndices = [54, 103, 67, 109, 10, 338, 297, 332, 284];
  for (let k = 0; k < arcIndices.length; k++) {
    const idx = arcIndices[k];
    const t = k / (arcIndices.length - 1);
    xy[idx * 2] = 65 + t * 170;
    xy[idx * 2 + 1] = 45;
  }

  // Fill in any remaining landmarks
  for (let i = 0; i < 478; i++) {
    if (xy[i * 2] === 0 && xy[i * 2 + 1] === 0) {
      xy[i * 2] = 150 + 60 * Math.cos((i / 478) * 2 * Math.PI);
      xy[i * 2 + 1] = 150 + 80 * Math.sin((i / 478) * 2 * Math.PI);
    }
  }

  // Segmentation maps (skin everywhere inside face boundary)
  const faceSkin = new Float32Array(n).fill(1.0);
  const hair = new Float32Array(n).fill(0.0);
  const background = new Float32Array(n).fill(0.0);
  const bodySkin = new Float32Array(n).fill(0.0);
  const clothes = new Float32Array(n).fill(0.0);
  const others = new Float32Array(n).fill(0.0);

  // RGB and Lab
  const rgb = new Uint8Array(n * 3);
  const L = new Float32Array(n).fill(65);
  const a = new Float32Array(n).fill(14);
  const b = new Float32Array(n).fill(18);
  const Y = new Float32Array(n).fill(0.35);
  const logY = new Float32Array(n).fill(Math.log(0.35));

  for (let i = 0; i < n; i++) {
    rgb[i * 3] = 210;
    rgb[i * 3 + 1] = 160;
    rgb[i * 3 + 2] = 140;
  }

  return {
    width,
    height,
    rgb,
    valid: new Uint8Array(n).fill(1),
    lab: { L, a, b, Y, logY },
    landmarks: { xy, width, height, iod: 80 },
    z: new Float32Array(478),
    pxPerMm: 3.5,
    sourceIod: 80,
    cropToSource: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    seg: { background, hair, bodySkin, faceSkin, clothes, others },
  };
}

function makeMockQuality(): QualityAssessment {
  return {
    issues: [],
    notes: [],
    factors: {
      sharpness: 0.9,
      exposure: 0.95,
      lighting: 0.9,
      pose: 1.0,
      resolution: 0.85,
      naturalDetail: 0.9,
      noise: 0.95,
      expression: 1.0,
    },
    diagnostics: {
      scleraY: 0.48,
    },
  };
}

describe('V3 Anatomical Regions Pipeline', () => {
  it('constructs all canonical anatomical regions defined in V3 specification', () => {
    const face = makeMockAlignedFace();
    const anatomicalV3 = buildAnatomicalRegionsV3(face.landmarks, face, 600, 600);

    const regionKeys = Object.keys(anatomicalV3.regions) as typeof ANATOMICAL_REGION_KEYS_V3[number][];
    assert.equal(regionKeys.length, ANATOMICAL_REGION_KEYS_V3.length);
    for (const key of ANATOMICAL_REGION_KEYS_V3) {
      const region = anatomicalV3.regions[key];
      assert.ok(region, `Region ${key} must exist`);
      assert.equal(region.key, key);
      assert.ok(region.nameEn.length > 0, `Region ${key} missing English name`);
      assert.ok(region.nameAr.length > 0, `Region ${key} missing Arabic name`);
      assert.ok(region.mask instanceof Uint8Array, `Region ${key} mask must be Uint8Array`);
      assert.ok(Array.isArray(region.outlineSource), `Region ${key} outlineSource must be array`);
      assert.ok(region.areaMm2 >= 0, `Region ${key} areaMm2 must be non-negative`);
    }
  });

  it('guarantees zero pixel overlap between all distinct anatomical regions (pairwise disjointness)', () => {
    const face = makeMockAlignedFace();
    const anatomicalV3 = buildAnatomicalRegionsV3(face.landmarks, face, 600, 600);
    const keys = ANATOMICAL_REGION_KEYS_V3;
    const n = face.width * face.height;

    // Accumulate sum across all masks
    const totalOccupancy = new Uint8Array(n);
    for (const key of keys) {
      const mask = anatomicalV3.regions[key].mask;
      for (let i = 0; i < n; i++) {
        if (mask[i]) {
          totalOccupancy[i] += 1;
          // Every pixel must belong to at most ONE region
          assert.equal(
            totalOccupancy[i],
            1,
            `Pixel ${i} belongs to multiple regions including ${key} (overlap violation)`,
          );
        }
      }
    }
  });

  it('evaluates region quality independently and flags local degradation', () => {
    const face = makeMockAlignedFace();
    const anatomicalV3 = buildAnatomicalRegionsV3(face.landmarks, face, 600, 600);
    const cheek = anatomicalV3.regions.cheekLeft;

    assert.ok(cheek.pixelCount > 0, `CheekLeft must contain rasterized pixels, got ${cheek.pixelCount}`);
    const normalQuality = assessRegionQuality(cheek, face);
    assert.ok(normalQuality.usableCoverage > 0, 'Usable coverage should be positive');
    assert.ok(normalQuality.clippedFraction < 0.05, 'Normal skin should not be clipped');
    assert.ok(normalQuality.crushedFraction < 0.05, 'Normal skin should not be crushed');

    // Simulate localized highlight blowout on the cheek
    for (let i = 0; i < cheek.mask.length; i++) {
      if (cheek.mask[i]) {
        face.rgb[i * 3] = 255;
        face.rgb[i * 3 + 1] = 255;
        face.rgb[i * 3 + 2] = 255;
      }
    }
    const blownQuality = assessRegionQuality(cheek, face);
    assert.ok(blownQuality.clippedFraction > 0.8, 'Blown cheek should have high clippedFraction');
  });

  it('enforces explicit unavailable state with honest reason codes instead of fake zeros', () => {
    const face = makeMockAlignedFace();
    const anatomicalV3 = buildAnatomicalRegionsV3(face.landmarks, face, 600, 600);
    const forehead = anatomicalV3.regions.foreheadCenter;
    const quality = assessRegionQuality(forehead, face);

    const ctx: RegionalMeasurementContext = {
      face,
      allRegions: anatomicalV3.regions,
      illumination: 0.5,
      baselineRednessRatio: 0.2,
      cache: new Map(),
    };

    // Under-eye feature is anatomically unsupported on the forehead
    const underEyeOnForehead = measureRegionFeature('underEye', forehead, quality, ctx);
    assert.equal(underEyeOnForehead.status, 'unavailable');
    assert.equal(underEyeOnForehead.score, null);
    assert.equal(underEyeOnForehead.confidence, null);
    assert.ok(underEyeOnForehead.unavailableReason !== undefined);

    // Feature feasibility check returns explicit reasons
    const lowResFeasibility = checkFeatureFeasibility('pores', 'cheekLeft', quality, 3.0); // 3.0 px/mm is below 4.5
    assert.equal(lowResFeasibility, 'low_resolution');
  });

  it('aggregates region measurements into complete V3 summary and legacy results', () => {
    const face = makeMockAlignedFace();
    const anatomicalV3 = buildAnatomicalRegionsV3(face.landmarks, face, 600, 600);
    const quality = makeMockQuality();

    const aggregate = aggregateV3Analysis(face, anatomicalV3, quality, 'en');

    // Verify regionsV3
    assert.ok(aggregate.regionsV3);
    for (const key of ANATOMICAL_REGION_KEYS_V3) {
      const rep = aggregate.regionsV3[key];
      assert.ok(rep);
      assert.equal(rep.key, key);
      assert.ok(rep.features);
      for (const f of FEATURE_KEYS_V3) {
        assert.ok(rep.features[f], `Region ${key} missing feature ${f}`);
      }
    }

    // Verify featureSummaries
    assert.ok(aggregate.featureSummaries);
    for (const f of FEATURE_KEYS_V3) {
      const summary = aggregate.featureSummaries[f];
      assert.ok(summary);
      assert.equal(summary.feature, f);
      assert.ok(summary.totalRegionCount > 0);
    }

    // Verify legacyAnalysis compatibility
    assert.ok(aggregate.legacyAnalysis);
    for (const k of ['pigmentation', 'redness', 'texture', 'blemishes', 'shine', 'underEye'] as const) {
      const res = aggregate.legacyAnalysis[k];
      assert.ok(res, `Legacy result for ${k} must exist`);
      assert.ok(res.confidence >= 0 && res.confidence <= 1);
    }
  });
});
