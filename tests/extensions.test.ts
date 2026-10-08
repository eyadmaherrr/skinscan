import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { AlignedFace } from '../lib/skin-analysis/alignment';
import { blobness } from '../lib/skin-analysis/extensions/acne';
import { classifyAcneSeverity } from '../lib/skin-analysis/extensions/acne-severity';
import {
  DERM_FOUNDATION_DIM,
  extractDermFoundation,
  isAllowedServiceUrl,
  validateEmbedding,
} from '../lib/skin-analysis/extensions/derm-foundation';
import { getOptionalSession } from '../lib/skin-analysis/models/runtime';
import type { Spot } from '../lib/skin-analysis/metrics/blemishes';

/** Minimal aligned-face stand-in: uniform skin colour, optional L* pattern. */
function fakeFace(size = 120, L?: (x: number, y: number) => number): AlignedFace {
  const n = size * size;
  const rgb = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) rgb.set([200, 160, 135], i * 3);
  const lab = { L: new Float32Array(n), a: new Float32Array(n).fill(14), b: new Float32Array(n).fill(18), Y: new Float32Array(n).fill(0.4), logY: new Float32Array(n).fill(Math.log(0.4)) };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) lab.L[y * size + x] = L ? L(x, y) : 68;
  return { width: size, height: size, rgb, lab, pxPerMm: 4 } as unknown as AlignedFace;
}

describe('Derm Foundation adapter', () => {
  const good = Array.from({ length: DERM_FOUNDATION_DIM }, (_, i) => Math.sin(i) / 10);
  let server: Server;
  let base = '';
  let mode: 'ok' | 'short' | 'slow' | 'error' = 'ok';
  let lastAuth = '';
  let lastType = '';

  before(async () => {
    server = createServer((req, res) => {
      lastAuth = req.headers.authorization ?? '';
      lastType = req.headers['content-type'] ?? '';
      req.resume();
      req.on('end', () => {
        if (mode === 'slow') return setTimeout(() => res.end('{}'), 3000);
        if (mode === 'error') {
          res.statusCode = 500;
          return res.end('boom');
        }
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ embedding: mode === 'ok' ? good : good.slice(0, 10) }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  it('validates embedding shape and values', () => {
    assert.equal(validateEmbedding(good).length, DERM_FOUNDATION_DIM);
    assert.throws(() => validateEmbedding(good.slice(1)));
    assert.throws(() => validateEmbedding([...good.slice(1), Number.NaN]));
    assert.throws(() => validateEmbedding(new Array(DERM_FOUNDATION_DIM).fill(0)));
    assert.throws(() => validateEmbedding('nope'));
  });

  it('only allows HTTPS or internal HTTP services', () => {
    assert.ok(isAllowedServiceUrl('https://embed.example.org'));
    assert.ok(isAllowedServiceUrl('http://localhost:8080'));
    assert.ok(isAllowedServiceUrl('http://derm-foundation:8080'));
    assert.ok(isAllowedServiceUrl('http://derm-foundation.internal:8080'));
    assert.ok(isAllowedServiceUrl('http://service.local:3000'));
    assert.ok(!isAllowedServiceUrl('http://example.com'));
    assert.ok(!isAllowedServiceUrl('ftp://localhost'));
    assert.ok(!isAllowedServiceUrl('not a url'));
  });

  it('does not run when disabled and reports not_configured without a valid URL', async () => {
    const off = await extractDermFoundation(fakeFace(), { enabled: false, url: base, token: '', timeoutMs: 1000 });
    assert.deepEqual(off.report, { enabled: false, featureExtractionStatus: 'not_run', downstreamTasks: [] });
    const bad = await extractDermFoundation(fakeFace(), { enabled: true, url: 'http://example.com', token: '', timeoutMs: 1000 });
    assert.equal(bad.report.featureExtractionStatus, 'not_configured');
  });

  it('extracts and validates an embedding from the service, sending a PNG with the token', async () => {
    mode = 'ok';
    const res = await extractDermFoundation(fakeFace(), { enabled: true, url: base, token: 's3cret', timeoutMs: 2000 });
    assert.equal(res.report.featureExtractionStatus, 'ok');
    assert.equal(res.embedding?.length, DERM_FOUNDATION_DIM);
    assert.equal(lastAuth, 'Bearer s3cret');
    assert.equal(lastType, 'image/png');
    assert.ok(!JSON.stringify(res.report).includes('0.0'), 'report must not carry the embedding');
  });

  it('fails safely on bad output, server errors and timeouts', async () => {
    for (const m of ['short', 'error', 'slow'] as const) {
      mode = m;
      const res = await extractDermFoundation(fakeFace(), { enabled: true, url: base, token: '', timeoutMs: 1000 });
      assert.equal(res.report.featureExtractionStatus, 'failed', m);
      assert.equal(res.embedding, null);
    }
  });
});

describe('acne severity adapter', () => {
  const modelPath = path.join(process.cwd(), 'models', 'optional', 'acne_severity.onnx');

  it('is disabled without a model path and not_configured when the file is missing', async () => {
    // Only file names inside models/optional are accepted from the environment.
    const prev = process.env.SKINSCAN_ACNE_SEVERITY_MODEL;
    process.env.SKINSCAN_ACNE_SEVERITY_MODEL = '../../etc/acne_severity.onnx';
    const { extensionConfig } = await import('../lib/config');
    assert.equal(extensionConfig().acneSeverityModel, modelPath);
    process.env.SKINSCAN_ACNE_SEVERITY_MODEL = prev;
    assert.equal((await classifyAcneSeverity(fakeFace(), '')).status, 'disabled');
    assert.equal((await classifyAcneSeverity(fakeFace(), path.join(process.cwd(), 'models', 'missing.onnx'))).status, 'not_configured');
  });

  it('returns valid probabilities over the four documented classes', { skip: !existsSync(modelPath) && 'optional model not converted' }, async () => {
    const res = await classifyAcneSeverity(fakeFace(256), modelPath);
    assert.equal(res.status, 'ok');
    const probs = Object.values(res.probabilities ?? {});
    assert.deepEqual(Object.keys(res.probabilities ?? {}), ['level0', 'level1', 'level2', 'level3']);
    assert.ok(Math.abs(probs.reduce((s, p) => s + p, 0) - 1) < 0.01);
    assert.ok(res.label && res.scale);
  });

  it('caches the optional model session', { skip: !existsSync(modelPath) && 'optional model not converted' }, async () => {
    const { onnxSha256 } = JSON.parse(await (await import('node:fs/promises')).readFile(modelPath.replace('.onnx', '.json'), 'utf8'));
    assert.equal(getOptionalSession(modelPath, onnxSha256), getOptionalSession(modelPath, onnxSha256));
  });
});

describe('spot shape test', () => {
  it('keeps round spots and rejects fold-like lines', () => {
    const roundFace = fakeFace(60, (x, y) => 68 - 8 * Math.exp(-((x - 30) ** 2 + (y - 30) ** 2) / 18));
    const lineFace = fakeFace(60, (x, y) => 68 - 8 * Math.exp(-((x - 30) ** 2) / 18) + 0 * y);
    const spot: Spot = { x: 30, y: 30, sigma: 2.5, strength: 2, tone: 'dark', region: 'cheekL' };
    assert.ok(blobness(roundFace, spot) > 0.6);
    assert.ok(blobness(lineFace, spot) < 0.3);
  });
});
