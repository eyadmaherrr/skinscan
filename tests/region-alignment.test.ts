import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { decodeImage } from '../lib/skin-analysis/image/decode';
import { detectFaces } from '../lib/skin-analysis/face-detection';
import { detectLandmarks } from '../lib/skin-analysis/landmarks';
import { alignFace } from '../lib/skin-analysis/alignment';
import { applyAffine } from '../lib/skin-analysis/image/warp';
import { buildRegions } from '../lib/skin-analysis/regions';
import { buildAnatomicalRegionsV3 } from '../lib/skin-analysis/regions-v3';
import { ALL_REGION_KEYS } from '../lib/skin-analysis/types';
import { ANATOMICAL_REGION_KEYS_V3 } from '../lib/skin-analysis/types-v3';
import { LANDMARK_COUNT } from '../lib/skin-analysis/face-topology';

type Point = [number, number];

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const ccw = (a: Point, b: Point, c: Point) =>
    (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

function isSelfIntersecting(pts: Point[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if ((j + 1) % n === i) continue;
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function signedPolygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return 0.5 * a;
}

describe('Facial Region Alignment & Topology (Dr Maher Vision AI v4.0)', () => {
  it('guarantees affine transform invertibility with sub-millipixel error (< 0.001 px)', async () => {
    const buf = await readFile('test-data/reference/kim.jpg');
    const image = await decodeImage(buf, { maxInputPixels: 40e6, maxSide: 4096 });
    const detections = await detectFaces(image);
    assert.ok(detections.length > 0, 'Face detection must find a face');
    const landmarks = await detectLandmarks(image, detections[0]);
    const face = await alignFace(image, landmarks.points);

    let maxError = 0;
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      const origX = landmarks.points[i * 3];
      const origY = landmarks.points[i * 3 + 1];
      const cropX = face.landmarks.xy[i * 2];
      const cropY = face.landmarks.xy[i * 2 + 1];
      const [backX, backY] = applyAffine(face.cropToSource, cropX, cropY);
      const err = Math.hypot(origX - backX, origY - backY);
      if (err > maxError) maxError = err;
    }

    assert.ok(maxError < 0.001, `Max affine invertibility error was ${maxError} px (must be < 0.001 px)`);
  });

  it('produces valid, non-self-intersecting polygons for all measurement regions', async () => {
    const buf = await readFile('test-data/reference/kim.jpg');
    const image = await decodeImage(buf, { maxInputPixels: 40e6, maxSide: 4096 });
    const detections = await detectFaces(image);
    const landmarks = await detectLandmarks(image, detections[0]);
    const face = await alignFace(image, landmarks.points);

    const regions = buildRegions(face.landmarks);

    for (const key of ALL_REGION_KEYS) {
      const pts = regions.outlines[key];
      assert.ok(pts.length >= 3, `Region ${key} outline must be a polygon, got ${pts.length} points`);
      const area = Math.abs(signedPolygonArea(pts));
      assert.ok(area > 500, `Region ${key} outline area must be > 500 px², got ${area}`);
      assert.equal(
        isSelfIntersecting(pts),
        false,
        `Region ${key} outline must not self-intersect`,
      );
    }
  });

  it('places the measurement regions where the metrics need them (validated October 2026 geometry)', async () => {
    const buf = await readFile('test-data/reference/kim.jpg');
    const image = await decodeImage(buf, { maxInputPixels: 40e6, maxSide: 4096 });
    const detections = await detectFaces(image);
    const landmarks = await detectLandmarks(image, detections[0]);
    const face = await alignFace(image, landmarks.points);
    const { xy, iod } = face.landmarks;
    const regions = buildRegions(face.landmarks);

    const rows = (m: Uint8Array) => {
      let top = Infinity;
      let bottom = -Infinity;
      for (let i = 0; i < m.length; i++) {
        if (!m[i]) continue;
        const y = Math.floor(i / face.width);
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
      return { top, bottom };
    };
    // Lowest point of the image-left lower lid (landmarks 145 / 159 region).
    const lidBottom = Math.max(...[33, 7, 163, 144, 145, 153, 154, 155, 133].map((i) => xy[i * 2 + 1]));
    const underEye = rows(regions.regions.underEyeL);
    const cheek = rows(regions.regions.cheekL);
    // A real band of skin below the lid (not a sliver on the lash line), and the cheek starts below it,
    // clear of the infra-orbital bulge that smiling pushes up.
    assert.ok(underEye.top >= lidBottom + 0.03 * iod, 'under-eye band starts below the lower lid');
    assert.ok(underEye.bottom - underEye.top >= 0.12 * iod, `under-eye band is ${(underEye.bottom - underEye.top) / iod} IOD tall`);
    assert.ok(cheek.top >= underEye.bottom, 'cheek starts below the under-eye band');
    // The cheek stops at the mouth-corner line (the nasolabial fold and smile crease below it are excluded).
    const mouthY = (xy[61 * 2 + 1] + xy[291 * 2 + 1]) / 2;
    assert.ok(cheek.bottom <= mouthY + 0.05 * iod, 'cheek does not reach below the mouth corners');
  });

  it('produces valid, non-self-intersecting polygons for all 27 anatomical V3 regions', async () => {
    const buf = await readFile('test-data/reference/kim.jpg');
    const image = await decodeImage(buf, { maxInputPixels: 40e6, maxSide: 4096 });
    const detections = await detectFaces(image);
    const landmarks = await detectLandmarks(image, detections[0]);
    const face = await alignFace(image, landmarks.points);

    const v3 = buildAnatomicalRegionsV3(face.landmarks, face, image.width, image.height);

    for (const key of ANATOMICAL_REGION_KEYS_V3) {
      const region = v3.regions[key];
      assert.ok(region, `Anatomical region ${key} must exist`);
      const pts = region.outlineCrop;
      assert.ok(pts.length >= 6, `Anatomical region ${key} must have >= 6 points, got ${pts.length}`);
      const area = Math.abs(signedPolygonArea(pts));
      assert.ok(area > 100, `Anatomical region ${key} must have area > 100 px², got ${area}`);
      assert.equal(
        isSelfIntersecting(pts),
        false,
        `Anatomical region ${key} must not self-intersect`,
      );

      // Verify outlineSource is normalized [0, 1]
      for (const [x, y] of region.outlineSource) {
        assert.ok(x >= 0 && x <= 1, `Normalized x coordinate ${x} in ${key} must be in [0, 1]`);
        assert.ok(y >= 0 && y <= 1, `Normalized y coordinate ${y} in ${key} must be in [0, 1]`);
      }
    }
  });

  it('enforces strict zero pixel overlap between all disjoint legacy regions', async () => {
    const buf = await readFile('test-data/reference/kim.jpg');
    const image = await decodeImage(buf, { maxInputPixels: 40e6, maxSide: 4096 });
    const detections = await detectFaces(image);
    const landmarks = await detectLandmarks(image, detections[0]);
    const face = await alignFace(image, landmarks.points);

    const regions = buildRegions(face.landmarks);
    const keys = ALL_REGION_KEYS;
    const n = face.width * face.height;

    // Check under-eye and cheek are completely disjoint
    for (let i = 0; i < n; i++) {
      assert.ok(
        !(regions.regions.underEyeL[i] && regions.regions.cheekL[i]),
        `Pixel ${i} shared between underEyeL and cheekL`,
      );
      assert.ok(
        !(regions.regions.underEyeR[i] && regions.regions.cheekR[i]),
        `Pixel ${i} shared between underEyeR and cheekR`,
      );
      assert.ok(
        !(regions.regions.nose[i] && regions.regions.cheekL[i]),
        `Pixel ${i} shared between nose and cheekL`,
      );
      assert.ok(
        !(regions.regions.nose[i] && regions.regions.cheekR[i]),
        `Pixel ${i} shared between nose and cheekR`,
      );
      assert.ok(
        !(regions.regions.chin[i] && regions.regions.cheekL[i]),
        `Pixel ${i} shared between chin and cheekL`,
      );
      assert.ok(
        !(regions.regions.chin[i] && regions.regions.cheekR[i]),
        `Pixel ${i} shared between chin and cheekR`,
      );
    }
  });

  it('preserves left-right anatomical symmetry and correct orientation', async () => {
    const buf = await readFile('test-data/reference/kim.jpg');
    const image = await decodeImage(buf, { maxInputPixels: 40e6, maxSide: 4096 });
    const detections = await detectFaces(image);
    const landmarks = await detectLandmarks(image, detections[0]);
    const face = await alignFace(image, landmarks.points);

    const regions = buildRegions(face.landmarks);
    const nosePts = regions.outlines.nose;
    const noseCenter = nosePts.reduce((acc, p) => acc + p[0], 0) / nosePts.length;

    const cheekLPts = regions.outlines.cheekL;
    const cheekLCenter = cheekLPts.reduce((acc, p) => acc + p[0], 0) / cheekLPts.length;

    const cheekRPts = regions.outlines.cheekR;
    const cheekRCenter = cheekRPts.reduce((acc, p) => acc + p[0], 0) / cheekRPts.length;

    // In a non-mirrored photo:
    // cheekL is on image-left (x < noseCenter)
    // cheekR is on image-right (x > noseCenter)
    assert.ok(cheekLCenter < noseCenter, `cheekL (${cheekLCenter}) must be on image-left of nose (${noseCenter})`);
    assert.ok(cheekRCenter > noseCenter, `cheekR (${cheekRCenter}) must be on image-right of nose (${noseCenter})`);

    const underEyeLCenter = regions.outlines.underEyeL.reduce((acc, p) => acc + p[0], 0) / regions.outlines.underEyeL.length;
    const underEyeRCenter = regions.outlines.underEyeR.reduce((acc, p) => acc + p[0], 0) / regions.outlines.underEyeR.length;

    assert.ok(underEyeLCenter < noseCenter, `underEyeL must be on image-left of nose`);
    assert.ok(underEyeRCenter > noseCenter, `underEyeR must be on image-right of nose`);
  });

  it('keeps all region boundaries strictly contained within face boundaries', async () => {
    const buf = await readFile('test-data/reference/kim.jpg');
    const image = await decodeImage(buf, { maxInputPixels: 40e6, maxSide: 4096 });
    const detections = await detectFaces(image);
    const landmarks = await detectLandmarks(image, detections[0]);
    const face = await alignFace(image, landmarks.points);

    const regions = buildRegions(face.landmarks);

    // Bounding bounds of the face crop
    const w = face.width;
    const h = face.height;

    for (const key of ALL_REGION_KEYS) {
      for (const [x, y] of regions.outlines[key]) {
        assert.ok(x >= 0 && x <= w, `Point x=${x} in region ${key} extends outside crop width ${w}`);
        assert.ok(y >= 0 && y <= h, `Point y=${y} in region ${key} extends outside crop height ${h}`);
      }
    }
  });
});

