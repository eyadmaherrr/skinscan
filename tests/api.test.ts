import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import sharp from 'sharp';
import type { ScanFailure, ScanSuccess } from '../lib/skin-analysis/types';

process.env.SKIN_SCAN_RATE_LIMIT = '1000';
process.env.SKINSCAN_REQUIRE_AUTH = 'true';

let POST: (request: Request) => Promise<Response>;

before(async () => {
  ({ POST } = await import('../app/api/skin-scan/route'));
});

function upload(bytes: Uint8Array | null, type = 'image/jpeg', auth = true): Request {
  const form = new FormData();
  if (bytes) form.append('image', new Blob([new Uint8Array(bytes)], { type }), 'photo');
  const headers = new Headers();
  if (auth) headers.set('x-patient-session', 'test-session-token');
  return new Request('http://localhost/api/skin-scan', { method: 'POST', body: form, headers });
}

describe('POST /api/skin-scan', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await POST(upload(null, 'image/jpeg', false));
    assert.equal(res.status, 401);
    const body = (await res.json()) as ScanFailure;
    assert.equal(body.error.code, 'unauthenticated');
  });

  it('rejects a request without an image', async () => {
    const res = await POST(upload(null));
    assert.equal(res.status, 400);
    const body = (await res.json()) as ScanFailure;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'invalid_request');
  });

  it('rejects non-multipart requests', async () => {
    const res = await POST(
      new Request('http://localhost/api/skin-scan', {
        method: 'POST',
        body: '{}',
        headers: { 'content-type': 'application/json', 'x-patient-session': 'test-session-token' },
      }),
    );
    assert.equal(res.status, 400);
  });

  it('rejects a file that only pretends to be an image', async () => {
    const res = await POST(upload(new TextEncoder().encode('not really a png'), 'image/png'));
    assert.equal(res.status, 415);
    assert.equal(((await res.json()) as ScanFailure).error.code, 'unsupported_type');
  });

  it('rejects unsupported declared types', async () => {
    const res = await POST(upload(new TextEncoder().encode('<svg/>'), 'image/svg+xml'));
    assert.equal(res.status, 415);
  });

  it('asks for a retake when there is no face', async () => {
    const blank = await sharp({ create: { width: 900, height: 900, channels: 3, background: '#c9b39c' } }).jpeg().toBuffer();
    const res = await POST(upload(blank));
    assert.equal(res.status, 200);
    const body = (await res.json()) as ScanFailure;
    assert.equal(body.error.code, 'image_quality');
    assert.equal(body.imageQuality?.issues[0].code, 'no_face');
    assert.ok(!JSON.stringify(body).includes('stack'));
  });

  const sample = path.join(process.cwd(), 'test-data', 'reference', 'kim.jpg');
  it('analyses a clear frontal photo deterministically', { skip: !existsSync(sample) && 'run scripts/fetch-test-images.ts first' }, async () => {
    const bytes = readFileSync(sample);
    const first = (await (await POST(upload(bytes))).json()) as ScanSuccess;
    const second = (await (await POST(upload(bytes))).json()) as ScanSuccess;
    assert.equal(first.success, true);
    assert.ok(first.overallConfidence > 0 && first.overallConfidence <= 1);
    for (const m of Object.values(first.analysis)) {
      assert.ok(m.score === null || (m.score >= 0 && m.score <= 100));
      assert.ok(m.confidence >= 0 && m.confidence <= 1);
      assert.ok(m.explanation.length > 10);
    }
    const strip = (r: ScanSuccess) => ({ ...r, scanId: '', createdAt: '' });
    assert.deepEqual(strip(first), strip(second));

    // Backward compatibility: the original contract is intact.
    for (const key of ['pigmentation', 'redness', 'texture', 'blemishes', 'shine', 'underEye']) assert.ok(key in first.analysis);
    assert.ok(first.regions.length >= 7 && first.imageQuality.acceptable && first.engine && first.methodologyVersion);

    // Extensions are present, well-formed and never fabricated.
    const statuses = ['ok', 'insufficient_quality', 'disabled', 'not_configured', 'failed'];
    assert.ok(first.acne && statuses.includes(first.acne.status));
    for (const l of first.acne?.lesions ?? []) {
      assert.ok(l.x >= 0 && l.x <= 1 && l.y >= 0 && l.y <= 1 && l.r > 0 && l.r < 0.2);
      assert.ok(l.tone === 'red' || l.tone === 'dark');
    }
    assert.ok(first.pores && statuses.includes(first.pores.status));
    if (first.pores?.status !== 'ok') assert.equal(first.pores?.visibilityScore, null);
    assert.ok(first.pores?.heatmap === null || first.pores?.heatmap?.startsWith('data:image/png;base64,'));
    assert.equal(first.dermFoundation?.featureExtractionStatus, 'not_run');
    assert.equal(first.acne?.severity.components?.imageClassifier.status, process.env.SKINSCAN_ACNE_SEVERITY_MODEL ? 'ok' : 'disabled');

    // No internals leak to clients.
    const text = JSON.stringify(first);
    assert.ok(!/embedding/i.test(text));
    assert.ok(!/[A-Za-z]:\\\\|\/models\/|node_modules|\.onnx/.test(text));
  });
});
