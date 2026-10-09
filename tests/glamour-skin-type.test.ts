import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { AlignedFace } from '../lib/skin-analysis/alignment';
import {
  analyzeSkinType,
  evaluateVisibleShine,
  extractRegionCrop,
  GLAMOUR_CLASSES,
  GLAMOUR_INPUT_SIZE,
  GLAMOUR_MODEL_NAME,
  rgbToVitTensor,
  softmax,
} from '../lib/skin-analysis/extensions/glamour-skin-type';
import type { MetricContext } from '../lib/skin-analysis/metrics/common';
import type { QualityAssessment } from '../lib/skin-analysis/quality';

function makeMockContext(options?: { shiny?: boolean }): MetricContext {
  const size = 100;
  const n = size * size;
  const rgb = new Uint8Array(n * 3);
  const lab = {
    L: new Float32Array(n).fill(65),
    a: new Float32Array(n).fill(15),
    b: new Float32Array(n).fill(18),
    Y: new Float32Array(n).fill(0.4),
    logY: new Float32Array(n).fill(Math.log(0.4)),
  };

  for (let i = 0; i < n; i++) {
    rgb[i * 3] = 210;
    rgb[i * 3 + 1] = 170;
    rgb[i * 3 + 2] = 140;
  }

  // If shiny, inject specular highlight pixels in forehead region
  if (options?.shiny) {
    for (let y = 10; y < 30; y++) {
      for (let x = 20; x < 80; x++) {
        const idx = y * size + x;
        rgb[idx * 3] = 252;
        rgb[idx * 3 + 1] = 252;
        rgb[idx * 3 + 2] = 252;
        lab.L[idx] = 98;
        lab.Y[idx] = 0.95;
        lab.a[idx] = 1;
        lab.b[idx] = 2;
      }
    }
  }

  const foreheadMask = new Uint8Array(n);
  const noseMask = new Uint8Array(n);
  const cheekLMask = new Uint8Array(n);
  const cheekRMask = new Uint8Array(n);
  const chinMask = new Uint8Array(n);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (y >= 5 && y < 35 && x >= 15 && x < 85) foreheadMask[idx] = 1;
      else if (y >= 35 && y < 65 && x >= 38 && x < 62) noseMask[idx] = 1;
      else if (y >= 35 && y < 75 && x >= 10 && x < 38) cheekLMask[idx] = 1;
      else if (y >= 35 && y < 75 && x >= 62 && x < 90) cheekRMask[idx] = 1;
      else if (y >= 75 && y < 95 && x >= 30 && x < 70) chinMask[idx] = 1;
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
    lab,
    pxPerMm: 3.5,
    sourceIod: 70,
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

  return {
    face,
    masks,
    quality,
    cache: new Map(),
    locale: 'en',
  };
}

describe('Glamour AI Skin Type & Visible Shine Module', () => {
  describe('Tensor Preprocessing & Softmax Math', () => {
    it('correctly maps RGB values to ViT NCHW format [-1, 1]', () => {
      const width = 2;
      const height = 2;
      // 4 pixels: Black (0,0,0), Mid (128,128,128), White (255,255,255), Color (255, 128, 0)
      const rgb = new Uint8Array([
        0, 0, 0,
        128, 128, 128,
        255, 255, 255,
        255, 128, 0,
      ]);

      const tensor = rgbToVitTensor(rgb, width, height);
      assert.equal(tensor.length, 3 * 4);

      // Channel 0 (R): 0 -> -1.0, 128 -> ~0.0039, 255 -> 1.0, 255 -> 1.0
      assert.ok(Math.abs(tensor[0] - (-1.0)) < 0.001);
      assert.ok(Math.abs(tensor[1] - (128 / 127.5 - 1)) < 0.001);
      assert.ok(Math.abs(tensor[2] - 1.0) < 0.001);
      assert.ok(Math.abs(tensor[3] - 1.0) < 0.001);

      // Channel 1 (G): offset by 4
      assert.ok(Math.abs(tensor[4] - (-1.0)) < 0.001);
      assert.ok(Math.abs(tensor[7] - (128 / 127.5 - 1)) < 0.001);

      // Channel 2 (B): offset by 8
      assert.ok(Math.abs(tensor[8] - (-1.0)) < 0.001);
      assert.ok(Math.abs(tensor[11] - (-1.0)) < 0.001);
    });

    it('computes stable softmax probabilities summing to 1.0', () => {
      const probs = softmax([2.0, 1.0, 0.1]);
      assert.equal(probs.length, 3);
      assert.ok(probs[0] > probs[1] && probs[1] > probs[2]);
      const sum = probs.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1.0) <= 0.01);

      // Numerical stability with large logits
      const largeProbs = softmax([1000, 1000, 999]);
      assert.ok(!Number.isNaN(largeProbs[0]));
      assert.ok(largeProbs[0] > 0);
    });

    it('extracts region crop resized to 224x224 float32 tensor', () => {
      const ctx = makeMockContext();
      const tensor = extractRegionCrop(ctx.face, ctx.masks.regions.forehead, GLAMOUR_INPUT_SIZE);
      assert.equal(tensor.length, 3 * GLAMOUR_INPUT_SIZE * GLAMOUR_INPUT_SIZE);
      // All values bounded in [-1.0, 1.0]
      for (let i = 0; i < 100; i++) {
        assert.ok(tensor[i] >= -1.01 && tensor[i] <= 1.01);
      }
    });
  });

  describe('Specular Highlight & Visible Shine Analysis', () => {
    it('measures low shine on matte skin and higher shine when specular highlights are present', () => {
      const matteCtx = makeMockContext({ shiny: false });
      const matteShine = evaluateVisibleShine(matteCtx);
      assert.ok(matteShine.score !== null);
      assert.ok(matteShine.tZoneScore !== null);
      assert.ok(matteShine.cheeksScore !== null);

      const shinyCtx = makeMockContext({ shiny: true });
      const shinyShine = evaluateVisibleShine(shinyCtx);

      assert.ok((shinyShine.score ?? 0) > (matteShine.score ?? 0));
      assert.ok((shinyShine.tZoneScore ?? 0) > (matteShine.tZoneScore ?? 0));
      assert.ok((shinyShine.regionalBreakdown.forehead ?? 0) > (matteShine.regionalBreakdown.forehead ?? 0));
    });
  });

  describe('Skin Type Adapter Execution', () => {
    let mockServer: Server;
    let mockUrl = '';

    before(async () => {
      mockServer = createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          res.setHeader('content-type', 'application/json');
          if (req.url?.includes('error')) {
            res.statusCode = 500;
            return res.end('{"error": "internal"}');
          }
          // Return simulated ViT classification output: oily dominant
          res.end(
            JSON.stringify({
              predictedType: 'oily',
              probabilities: { dry: 0.05, normal: 0.15, oily: 0.8 },
            }),
          );
        });
      });
      await new Promise<void>((r) => mockServer.listen(0, '127.0.0.1', r));
      mockUrl = `http://127.0.0.1:${(mockServer.address() as AddressInfo).port}/predict`;
    });

    after(() => mockServer.close());

    it('returns disabled status when enabled: false', async () => {
      const ctx = makeMockContext();
      const report = await analyzeSkinType(ctx, { enabled: false });
      assert.equal(report.status, 'disabled');
      assert.equal(report.predictedSkinType, null);
      assert.equal(report.probabilities, null);
    });

    it('returns not_configured with specular shine when model weights are not loaded', async () => {
      const ctx = makeMockContext();
      const report = await analyzeSkinType(ctx, {
        enabled: true,
        modelPath: 'models/optional/non_existent.onnx',
      });
      assert.equal(report.status, 'not_configured');
      assert.equal(report.predictedSkinType, null);
      assert.ok(report.visibleShine.score !== null);
      assert.ok(report.visibleShine.tZoneScore !== null);
      assert.ok(report.visibleShine.cheeksScore !== null);
    });

    it('successfully queries remote Glamour AI endpoint when configured', async () => {
      const ctx = makeMockContext();
      const report = await analyzeSkinType(ctx, {
        enabled: true,
        serviceUrl: mockUrl,
      });

      assert.equal(report.status, 'ok');
      assert.equal(report.predictedSkinType, 'oily');
      assert.ok(report.probabilities);
      assert.equal(report.probabilities.oily, 0.8);
      assert.ok(report.visibleShine.score !== null);
    });

    it('falls back gracefully to not_configured when remote service fails', async () => {
      const ctx = makeMockContext();
      const report = await analyzeSkinType(ctx, {
        enabled: true,
        serviceUrl: `${mockUrl}/error`,
      });

      assert.equal(report.status, 'not_configured');
      assert.equal(report.predictedSkinType, null);
      assert.ok(report.visibleShine.score !== null);
    });
  });
});

