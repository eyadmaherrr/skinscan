import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { analyzeImage, type AnalyzeOptions } from '../lib/skin-analysis';
import { buildRegions, type AlignedLandmarks } from '../lib/skin-analysis/regions';
import { decodeImage } from '../lib/skin-analysis/image/decode';
import { hessianRatio } from '../lib/skin-analysis/metrics/blobs';
import { smileScore } from '../lib/skin-analysis/quality';
import { LM } from '../lib/skin-analysis/face-topology';
import type { AlignedFace } from '../lib/skin-analysis/alignment';

describe('expression and smile classification', () => {
  function makeMockFace(coords: Partial<Record<number, [number, number]>>): AlignedFace {
    const xy = new Float32Array(478 * 2);
    // Default landmarks for mock face with IOD = 100
    // Eyes at (100, 100) and (200, 100)
    xy[LM.eyeInnerImgLeft * 2] = 135;
    xy[LM.eyeInnerImgLeft * 2 + 1] = 100;
    xy[LM.eyeInnerImgRight * 2] = 165;
    xy[LM.eyeInnerImgRight * 2 + 1] = 100;
    xy[LM.eyeOuterImgLeft * 2] = 100;
    xy[LM.eyeOuterImgLeft * 2 + 1] = 100;
    xy[LM.eyeOuterImgRight * 2] = 200;
    xy[LM.eyeOuterImgRight * 2 + 1] = 100;

    // Default neutral mouth: width = 100 (1.0 IOD), corners at y = 180, stomion at y = 180
    xy[LM.mouthCornerImgLeft * 2] = 100;
    xy[LM.mouthCornerImgLeft * 2 + 1] = 180;
    xy[LM.mouthCornerImgRight * 2] = 200;
    xy[LM.mouthCornerImgRight * 2 + 1] = 180;
    xy[LM.upperLipInner * 2] = 150;
    xy[LM.upperLipInner * 2 + 1] = 178;
    xy[LM.lowerLipInner * 2] = 150;
    xy[LM.lowerLipInner * 2 + 1] = 182;
    xy[LM.upperLipTop * 2] = 150;
    xy[LM.upperLipTop * 2 + 1] = 172;
    xy[LM.lowerLipBottom * 2] = 150;
    xy[LM.lowerLipBottom * 2 + 1] = 188;

    for (const [idxStr, pt] of Object.entries(coords)) {
      if (pt) {
        const idx = Number(idxStr);
        xy[idx * 2] = pt[0];
        xy[idx * 2 + 1] = pt[1];
      }
    }

    return {
      width: 300,
      height: 300,
      rgb: new Uint8Array(300 * 300 * 3),
      valid: new Uint8Array(300 * 300).fill(1),
      lab: {
        L: new Float32Array(300 * 300),
        a: new Float32Array(300 * 300),
        b: new Float32Array(300 * 300),
        Y: new Float32Array(300 * 300),
        logY: new Float32Array(300 * 300),
      },
      seg: {
        background: new Float32Array(300 * 300),
        hair: new Float32Array(300 * 300),
        bodySkin: new Float32Array(300 * 300),
        faceSkin: new Float32Array(300 * 300),
        clothes: new Float32Array(300 * 300),
        others: new Float32Array(300 * 300),
      },
      landmarks: {
        xy,
        width: 300,
        height: 300,
        iod: 100,
      },
      z: new Float32Array(478),
      pxPerMm: 3.5,
      sourceIod: 100,
      cropToSource: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    };
  }

  it('recognizes a neutral resting face without false smiling flag', () => {
    // Naturally wide resting mouth: mouthWidth = 1.15 IOD, but corners at stomion level
    const face = makeMockFace({
      [LM.mouthCornerImgLeft]: [92.5, 180],
      [LM.mouthCornerImgRight]: [207.5, 180],
      [LM.upperLipInner]: [150, 179],
      [LM.lowerLipInner]: [150, 181],
    });
    const result = smileScore(face);
    assert.ok(result.smile < 0.2, `Expected smile < 0.2, got ${result.smile}`);
  });

  it('detects genuine smiling with coordinated corner lift and widening', () => {
    // Smiling face: mouthWidth = 1.25 IOD, corners pulled UP to y = 170 (stomion at y = 180, so lift = +10px = 0.10 IOD)
    const face = makeMockFace({
      [LM.mouthCornerImgLeft]: [87.5, 170],
      [LM.mouthCornerImgRight]: [212.5, 170],
      [LM.upperLipInner]: [150, 176],
      [LM.lowerLipInner]: [150, 184],
    });
    const result = smileScore(face);
    assert.ok(result.smile >= 0.7, `Expected smile >= 0.7, got ${result.smile}`);
  });

  it('does not classify slightly parted lips without corner lift as smiling', () => {
    // Parted lips: opening = 0.12 IOD, but corners are downward (y = 183, stomion = 180)
    const face = makeMockFace({
      [LM.mouthCornerImgLeft]: [97.5, 183],
      [LM.mouthCornerImgRight]: [202.5, 183],
      [LM.upperLipInner]: [150, 174],
      [LM.lowerLipInner]: [150, 186],
    });
    const result = smileScore(face);
    assert.ok(result.smile < 0.15, `Expected smile < 0.15, got ${result.smile}`);
  });
});

describe('hessian eigenvalue ratio stability', () => {
  it('handles subpixel float coordinates without NaN or undefined indexing', () => {
    const w = 50;
    const h = 50;
    const grid = new Float32Array(w * h);
    // Draw a synthetic 2D Gaussian minimum at (25, 25)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d2 = (x - 25) ** 2 + (y - 25) ** 2;
        grid[y * w + x] = 100 + 30 * Math.exp(-d2 / 18);
      }
    }
    // Subpixel float coordinates
    const ratio = hessianRatio(grid, w, h, 25.34, 24.87);
    assert.ok(!Number.isNaN(ratio), 'hessianRatio returned NaN for float coordinates');
    assert.ok(ratio >= 0 && ratio <= 1, `Expected ratio between 0 and 1, got ${ratio}`);
  });

  it('gives high roundness for symmetric circular spot and low roundness for elongated ridge', () => {
    const w = 60;
    const h = 60;
    // Circular spot (inverted for local minimum)
    const circle = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d2 = (x - 30) ** 2 + (y - 30) ** 2;
        circle[y * w + x] = 10 * d2;
      }
    }
    const circleRatio = hessianRatio(circle, w, h, 30, 30);
    assert.ok(circleRatio > 0.8, `Expected circular spot ratio > 0.8, got ${circleRatio}`);

    // Elongated trench / line (curvature in y only)
    const line = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        line[y * w + x] = 10 * (y - 30) ** 2;
      }
    }
    const lineRatio = hessianRatio(line, w, h, 30, 30);
    assert.ok(lineRatio < 0.1, `Expected line ratio < 0.1, got ${lineRatio}`);
  });
});

describe('anatomical region disjointness and coverage', () => {
  it('keeps under-eye and cheek regions strictly disjoint with zero pixel overlap', () => {
    // Generate valid mock aligned landmarks
    const xy = new Float32Array(478 * 2);
    // Populate minimal required landmarks
    for (let i = 0; i < 478; i++) {
      xy[i * 2] = 150 + 50 * Math.cos((i / 478) * 2 * Math.PI);
      xy[i * 2 + 1] = 150 + 70 * Math.sin((i / 478) * 2 * Math.PI);
    }
    // Set specific topology anchors
    xy[LM.noseBridge * 2] = 150; xy[LM.noseBridge * 2 + 1] = 120;
    xy[LM.noseTip * 2] = 150; xy[LM.noseTip * 2 + 1] = 160;
    xy[LM.chin * 2] = 150; xy[LM.chin * 2 + 1] = 270;
    xy[LM.upperLipTop * 2] = 150; xy[LM.upperLipTop * 2 + 1] = 200;
    xy[LM.lowerLipBottom * 2] = 150; xy[LM.lowerLipBottom * 2 + 1] = 215;
    xy[LM.mouthCornerImgLeft * 2] = 110; xy[LM.mouthCornerImgLeft * 2 + 1] = 205;
    xy[LM.mouthCornerImgRight * 2] = 190; xy[LM.mouthCornerImgRight * 2 + 1] = 205;
    xy[LM.eyeOuterImgLeft * 2] = 90; xy[LM.eyeOuterImgLeft * 2 + 1] = 110;
    xy[LM.eyeInnerImgLeft * 2] = 130; xy[LM.eyeInnerImgLeft * 2 + 1] = 110;
    xy[LM.eyeInnerImgRight * 2] = 170; xy[LM.eyeInnerImgRight * 2 + 1] = 110;
    xy[LM.eyeOuterImgRight * 2] = 210; xy[LM.eyeOuterImgRight * 2 + 1] = 110;
    xy[LM.faceSideImgLeft * 2] = 70; xy[LM.faceSideImgLeft * 2 + 1] = 170;
    xy[LM.faceSideImgRight * 2] = 230; xy[LM.faceSideImgRight * 2 + 1] = 170;

    const lm: AlignedLandmarks = {
      xy,
      width: 300,
      height: 300,
      iod: 80,
    };
    const { regions } = buildRegions(lm);

    // Assert disjointness between cheeks and under-eyes
    for (let i = 0; i < lm.width * lm.height; i++) {
      if (regions.underEyeL[i] || regions.underEyeR[i]) {
        assert.equal(regions.cheekL[i], 0, `CheekL overlapped with underEye at index ${i}`);
        assert.equal(regions.cheekR[i], 0, `CheekR overlapped with underEye at index ${i}`);
      }
      if (regions.nose[i]) {
        assert.equal(regions.cheekL[i], 0, `CheekL overlapped with nose at index ${i}`);
        assert.equal(regions.cheekR[i], 0, `CheekR overlapped with nose at index ${i}`);
      }
    }
  });
});

describe('pipeline deterministic repeatability and pose gating', () => {
  it('produces identical analysis results on repeated runs of a reference portrait', async () => {
    const refPath = path.join(process.cwd(), 'test-data', 'reference', 'kim.jpg');
    if (!fs.existsSync(refPath)) return;

    const buf = fs.readFileSync(refPath);
    const options: AnalyzeOptions = {
      maxInputPixels: 40e6,
      maxSide: 2560,
      deadline: Date.now() + 60_000,
    };

    const res1 = await analyzeImage(buf, options);
    const res2 = await analyzeImage(buf, options);

    assert.equal(res1.success, true);
    assert.equal(res2.success, true);
    assert.equal(res1.overallConfidence, res2.overallConfidence);
    for (const k of ['redness', 'pigmentation', 'texture', 'blemishes', 'shine', 'underEye'] as const) {
      assert.equal(res1.analysis[k].score, res2.analysis[k].score, `Metric ${k} score mismatch`);
      assert.equal(res1.analysis[k].confidence, res2.analysis[k].confidence, `Metric ${k} confidence mismatch`);
    }
  });

  it('rejects turned or tilted head pose at the quality gate', async () => {
    const refPath = path.join(process.cwd(), 'test-data', 'reference', 'douglas.jpg');
    if (!fs.existsSync(refPath)) return;

    const buf = fs.readFileSync(refPath);
    const options: AnalyzeOptions = {
      maxInputPixels: 40e6,
      maxSide: 2560,
      deadline: Date.now() + 60_000,
    };

    await assert.rejects(
      async () => analyzeImage(buf, options),
      (err: any) => {
        assert.equal(err.code, 'image_quality');
        assert.ok(err.issues.some((issue: any) => issue.code === 'face_angle'));
        return true;
      },
    );
  });

  it('maintains score stability under minor illumination perturbation', async () => {
    const refPath = path.join(process.cwd(), 'test-data', 'reference', 'kim.jpg');
    if (!fs.existsSync(refPath)) return;

    const origBuf = fs.readFileSync(refPath);
    const perturbedBuf = await sharp(origBuf).modulate({ brightness: 1.03 }).jpeg().toBuffer();
    const options: AnalyzeOptions = {
      maxInputPixels: 40e6,
      maxSide: 2560,
      deadline: Date.now() + 60_000,
    };

    const resOrig = await analyzeImage(origBuf, options);
    const resPerturbed = await analyzeImage(perturbedBuf, options);

    assert.equal(resOrig.success, true);
    assert.equal(resPerturbed.success, true);
    // Exposure gain normalization mitigates global lighting shift; scores should change by <= 6 points
    for (const k of ['redness', 'pigmentation', 'texture', 'blemishes', 'shine', 'underEye'] as const) {
      if (resOrig.analysis[k].score !== null && resPerturbed.analysis[k].score !== null) {
        const delta = Math.abs(resOrig.analysis[k].score! - resPerturbed.analysis[k].score!);
        assert.ok(delta <= 6, `Metric ${k} score changed excessively (${delta} points) under 3% brightness perturbation`);
      }
    }
  });
});

