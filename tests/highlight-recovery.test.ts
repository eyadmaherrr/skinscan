import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AlignedFace } from '../lib/skin-analysis/alignment';
import { estimateRed, recoverClippedRed } from '../lib/skin-analysis/highlight-recovery';
import { rgbToLabImage, SRGB_TO_LINEAR } from '../lib/skin-analysis/image/color';
import type { FaceRegions } from '../lib/skin-analysis/regions';

const W = 120;
const H = 120;

function encode(linear: number): number {
  const c = Math.min(1, Math.max(0, linear));
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

/**
 * Uniform skin of one colour (linear r, g, b), with a brighter square in the
 * middle lit `boost` times more strongly, so its red channel clips.
 */
function scene(boost: number, base: [number, number, number] = [0.62, 0.38, 0.28]) {
  const rgb = new Uint8Array(W * H * 3);
  const inPatch = (x: number, y: number) => x >= 50 && x < 70 && y >= 50 && y < 70;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = inPatch(x, y) ? boost : 1;
      const o = (y * W + x) * 3;
      rgb[o] = encode(base[0] * k);
      rgb[o + 1] = encode(base[1] * k);
      rgb[o + 2] = encode(base[2] * k);
    }
  }
  const face = {
    width: W,
    height: H,
    rgb,
    valid: new Uint8Array(W * H).fill(1),
    pxPerMm: 2,
  } as unknown as AlignedFace;
  const regions = {
    faceOval: new Uint8Array(W * H).fill(1),
    features: new Uint8Array(W * H),
  } as unknown as FaceRegions;
  return { face, regions, centre: 60 * W + 60, base };
}

describe('clipped-red highlight recovery', () => {
  it('estimates the clipped red channel from the surrounding skin colour', () => {
    const { face, regions, centre, base } = scene(1.9);
    assert.equal(face.rgb[centre * 3], 255, 'red is clipped in the bright patch');
    assert.ok(face.rgb[centre * 3 + 1] < 240, 'green is not');
    const out = recoverClippedRed(face, regions);
    assert.equal(out.count, 400);
    assert.equal(out.recovered[centre], 1);
    const truth = base[0] * 1.9;
    assert.ok(Math.abs(out.redLinear[centre] - truth) / truth < 0.05, `estimate ${out.redLinear[centre]} vs ${truth}`);
    assert.ok(Number.isNaN(out.redLinear[0]), 'unclipped pixels are left alone');
  });

  it('restores the colour the clipped pixel has lost', () => {
    const { face, regions, centre } = scene(1.9);
    const out = recoverClippedRed(face, regions);
    const before = rgbToLabImage(face.rgb, W * H);
    const after = rgbToLabImage(face.rgb, W * H, 1, out.redLinear);
    // Redness is read as a* / (L* + 16), which does not change with how brightly the skin is lit.
    const redness = (lab: typeof before, i: number) => lab.a[i] / (lab.L[i] + 16);
    const reference = redness(before, 0);
    // Clipping makes the bright skin look far less red than the same skin elsewhere; recovery brings it back.
    assert.ok(redness(before, centre) < reference * 0.7);
    assert.ok(Math.abs(redness(after, centre) - reference) / reference < 0.05, `${redness(after, centre)} vs ${reference}`);
    assert.equal(after.a[0], before.a[0]);
  });

  it('keeps a shiny highlight whitish (diffuse skin colour plus neutral surface reflection)', () => {
    const [r0, g0, b0] = [0.62, 0.38, 0.28];
    const k = 1.2;
    const s = 0.25;
    const truth = k * r0 + s;
    const estimate = estimateRed(k * g0 + s, k * b0 + s, r0, g0, b0);
    assert.ok(Math.abs(estimate - truth) / truth < 1e-4, `${estimate} vs ${truth}`);
    // Painting it the skin colour instead would overstate its red value.
    assert.ok(((k * g0 + s) * r0) / g0 > truth * 1.05);
  });

  it('never lowers the red value below the clipped level', () => {
    const { face, regions, centre } = scene(1.9);
    const out = recoverClippedRed(face, regions);
    assert.ok(out.redLinear[centre] >= SRGB_TO_LINEAR[255]);
  });

  it('does not recover blown-out pixels where green is clipped as well', () => {
    const { face, regions, centre } = scene(3);
    assert.ok(face.rgb[centre * 3 + 1] >= 240, 'green clipped too');
    const out = recoverClippedRed(face, regions);
    assert.equal(out.recovered[centre], 0);
    assert.equal(out.count, 0);
  });

  it('does nothing when no pixel is clipped', () => {
    const { face, regions } = scene(1);
    assert.equal(recoverClippedRed(face, regions).count, 0);
  });
});
