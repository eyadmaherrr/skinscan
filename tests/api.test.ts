import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import type { ScanFailure, ScanSuccess } from '../lib/skin-analysis/types';
import { startClinicMock, VALID_TOKEN, type ClinicMock } from './clinic-mock';

process.env.SKIN_SCAN_RATE_LIMIT = '1000';
process.env.SKINSCAN_REQUIRE_AUTH = 'true';

let POST: (request: Request) => Promise<Response>;
let clinic: ClinicMock;

before(async () => {
  clinic = await startClinicMock();
  process.env.CLINIC_URL = clinic.url;
  ({ POST } = await import('../app/api/skin-scan/route'));
});
after(() => clinic.close());

function upload(bytes: Uint8Array | null, type = 'image/jpeg', token: string | null = VALID_TOKEN, locale?: string): Request {
  const form = new FormData();
  if (bytes) form.append('image', new Blob([new Uint8Array(bytes)], { type }), 'photo');
  const headers = new Headers();
  if (token) headers.set('x-patient-session', token);
  const query = locale ? `?locale=${locale}` : '';
  return new Request(`http://localhost/api/skin-scan${query}`, { method: 'POST', body: form, headers });
}

const ARABIC = /[\u0600-\u06FF]/;

describe('POST /api/skin-scan', () => {
  it('requires a session the clinic website accepts', async () => {
    for (const token of [null, 'b'.repeat(64), 'test-session-token', 'not a token!']) {
      const res = await POST(upload(null, 'image/jpeg', token));
      assert.equal(res.status, 401, String(token));
      const body = (await res.json()) as ScanFailure;
      assert.equal(body.error.code, 'unauthenticated');
    }
  });

  it('answers in Arabic when asked', async () => {
    const res = await POST(upload(null, 'image/jpeg', VALID_TOKEN, 'ar'));
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as ScanFailure).error.message, ARABIC);
    const blank = await sharp({ create: { width: 900, height: 900, channels: 3, background: '#c9b39c' } }).jpeg().toBuffer();
    const body = (await (await POST(upload(blank, 'image/jpeg', VALID_TOKEN, 'ar'))).json()) as ScanFailure;
    assert.equal(body.imageQuality?.issues[0].code, 'no_face');
    assert.match(body.imageQuality?.issues[0].message ?? '', ARABIC);
    assert.equal(body.error.message, body.imageQuality?.issues[0].message);
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
        headers: { 'content-type': 'application/json', 'x-patient-session': VALID_TOKEN },
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
    const strip = (r: ScanSuccess) => ({
      ...r,
      scanId: '',
      createdAt: '',
      ...(r.v3 ? { v3: { ...r.v3, executionMs: 0 } } : {}),
    });
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

    // Arabic: the same measurements, explained in Arabic.
    const ar = (await (await POST(upload(bytes, 'image/jpeg', VALID_TOKEN, 'ar'))).json()) as ScanSuccess;
    for (const [key, m] of Object.entries(ar.analysis)) {
      const en = first.analysis[key as keyof ScanSuccess['analysis']];
      assert.equal(m.score, en.score);
      assert.equal(m.confidence, en.confidence);
      assert.match(m.explanation, ARABIC);
      assert.ok(!m.explanation.includes('undefined'));
    }
    assert.equal(ar.acne?.lesionCandidateCount, first.acne?.lesionCandidateCount);
    assert.equal(ar.acne?.severity.label, first.acne?.severity.label);
    assert.match(ar.acne?.explanation ?? '', ARABIC);
    assert.match(ar.pores?.explanation ?? '', ARABIC);
    for (const note of ar.imageQuality.notes) assert.match(note, ARABIC);
  });
});
