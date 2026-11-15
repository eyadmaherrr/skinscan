import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { ProductLookupResponse, ProductSearchResponse } from '../lib/products/types';
import { startClinicMock, VALID_TOKEN, type ClinicMock } from './clinic-mock';

process.env.SKINSCAN_REQUIRE_AUTH = 'true';
process.env.SKINSCAN_PRODUCT_RATE_LIMIT = '1000';

/** 1×1 JPEG-typed bytes: the server only checks type and size, it doesn't decode. */
const IMAGE = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

/**
 * Stand-in for Open Beauty Facts: one known product, one without ingredients,
 * one Egyptian product it knows without ingredients, everything else unknown.
 */
async function startProductDb(): Promise<{ url: string; hits: string[]; failing: { on: boolean }; close: () => Promise<void> }> {
  const hits: string[] = [];
  const failing = { on: false };
  let base = '';
  const server: Server = createServer((req, res) => {
    hits.push(req.url ?? '');
    if (req.url?.startsWith('/img/')) {
      res.setHeader('content-type', 'image/jpeg');
      res.end(IMAGE);
      return;
    }
    if (failing.on) {
      res.statusCode = 502;
      res.end('bad gateway');
      return;
    }
    res.setHeader('content-type', 'application/json');
    const code = /\/api\/v2\/product\/(\d+)\.json/.exec(req.url ?? '')?.[1];
    if (code === '3337875597197') {
      res.end(
        JSON.stringify({
          status: 1,
          product: {
            code,
            product_name: 'CeraVe Schuimende Reinigingsgel',
            product_name_en: 'Foaming Cleanser',
            brands: 'CeraVe, L’Oréal',
            quantity: '236 ml',
            ingredients_text: 'Aqua, Glycerin, Niacinamide, Ceramide NP, Sodium Hyaluronate, Phenoxyethanol',
            ingredients_tags: ['en:aqua', 'en:glycerin', 'en:niacinamide'],
            categories_tags: ['en:facial-cleanser'],
            image_front_small_url: `${base}/img/front.200.jpg`,
          },
        }),
      );
      return;
    }
    if (code === '6223008210019') {
      // In the Egyptian list too (Cira panthenol cream): Open Beauty Facts has its name and photo, no ingredients.
      res.end(JSON.stringify({ status: 1, product: { code, product_name: 'Cira Panthenol Cream', image_front_small_url: `${base}/img/cira.jpg` } }));
      return;
    }
    if (code === '0036000291452') {
      res.end(JSON.stringify({ status: 1, product: { code, product_name: 'Day cream', image_front_small_url: 'https://evil.example/x.jpg' } }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ status: 0, status_verbose: 'product not found' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url: base, hits, failing, close: () => new Promise((resolve) => server.close(() => resolve())) };
}

let POST: (request: Request) => Promise<Response>;
let SEARCH: (request: Request) => Promise<Response>;
let clearProductCache: () => void;
let clinic: ClinicMock;
let db: Awaited<ReturnType<typeof startProductDb>>;

before(async () => {
  clinic = await startClinicMock();
  db = await startProductDb();
  process.env.CLINIC_URL = clinic.url;
  process.env.SKINSCAN_PRODUCT_DB_URL = db.url;
  ({ POST } = await import('../app/api/product-lookup/route'));
  ({ POST: SEARCH } = await import('../app/api/product-search/route'));
  ({ clearProductCache } = await import('../lib/products/open-beauty-facts'));
});
after(async () => {
  await clinic.close();
  await db.close();
});
beforeEach(() => {
  clearProductCache();
  db.hits.length = 0;
  db.failing.on = false;
});

function lookup(body: unknown, token: string | null = VALID_TOKEN, locale?: string, path = 'product-lookup'): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (token) headers.set('x-patient-session', token);
  return new Request(`http://localhost/api/${path}${locale ? `?locale=${locale}` : ''}`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/product-lookup', () => {
  it('requires a session the clinic website accepts', async () => {
    const response = await POST(lookup({ code: '3337875597197' }, 'b'.repeat(64)));
    assert.equal(response.status, 401);
    const body = (await response.json()) as ProductLookupResponse;
    assert.equal(body.success, false);
    assert.equal(db.hits.length, 0);
  });

  it('describes a known product from its ingredient list, with source and licence', async () => {
    const response = await POST(lookup({ code: '3337875597197' }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    const body = (await response.json()) as ProductLookupResponse;
    assert.ok(body.success && body.found);
    assert.equal(body.product.name, 'Foaming Cleanser');
    assert.equal(body.product.brand, 'CeraVe');
    assert.equal(body.product.ingredientCount, 6);
    assert.deepEqual(
      body.product.matches.map((m) => m.key),
      ['glycerin', 'niacinamide', 'ceramides', 'hyaluronicAcid'],
    );
    assert.match(body.product.image ?? '', /^data:image\/jpeg;base64,/);
    assert.equal(body.product.ingredientsFrom, 'openBeautyFacts');
    assert.equal(body.sources.length, 1);
    assert.equal(body.sources[0].name, 'Open Beauty Facts');
    assert.equal(body.sources[0].licence, 'ODbL');
    assert.equal(body.sources[0].imageLicence, 'CC BY-SA 3.0');
    assert.equal(body.sources[0].url, 'https://world.openbeautyfacts.org/product/3337875597197');
  });

  it('sends only the barcode, in the database path, and caches the answer', async () => {
    await POST(lookup({ code: '3337875597197' }));
    await POST(lookup({ code: '3337875597197' }));
    const productHits = db.hits.filter((h) => h.startsWith('/api/'));
    assert.equal(productHits.length, 1);
    assert.match(productHits[0], /^\/api\/v2\/product\/3337875597197\.json\?fields=/);
  });

  it('says "not found" for unknown products, without inventing anything', async () => {
    const response = await POST(lookup({ code: '96385074' }));
    const body = (await response.json()) as ProductLookupResponse;
    assert.deepEqual(body, { success: true, found: false, code: '96385074' });
  });

  it('keeps a product without an ingredient list undescribed, and ignores photos from other hosts', async () => {
    const response = await POST(lookup({ code: '036000291452' }));
    const body = (await response.json()) as ProductLookupResponse;
    assert.ok(body.success && body.found);
    assert.equal(body.product.code, '0036000291452');
    assert.equal(body.product.ingredientCount, 0);
    assert.deepEqual(body.product.matches, []);
    assert.equal(body.product.ingredientsText, null);
    assert.equal(body.product.image, null);
    assert.equal(body.sources[0].imageLicence, null);
    assert.ok(!db.hits.some((h) => h.includes('evil')));
  });

  it('rejects invalid barcodes and malformed requests before asking the database', async () => {
    let response = await POST(lookup({ code: '3337875597198' }, VALID_TOKEN, 'ar'));
    assert.equal(response.status, 400);
    let body = (await response.json()) as ProductLookupResponse;
    assert.ok(!body.success);
    assert.equal(body.error.code, 'invalid_barcode');
    assert.match(body.error.message, /[؀-ۿ]/);

    response = await POST(lookup('not json'));
    body = (await response.json()) as ProductLookupResponse;
    assert.ok(!body.success && body.error.code === 'invalid_request');

    response = await POST(lookup({ code: 3337875597197 }));
    assert.equal(response.status, 400);
    assert.equal(db.hits.length, 0);
  });

  it('reports the database being down as unavailable, and does not cache it', async () => {
    db.failing.on = true;
    let response = await POST(lookup({ code: '3337875597197' }));
    assert.equal(response.status, 503);
    const body = (await response.json()) as ProductLookupResponse;
    assert.ok(!body.success && body.error.code === 'unavailable');
    db.failing.on = false;
    response = await POST(lookup({ code: '3337875597197' }));
    assert.equal(response.status, 200);
  });

  it('names the product in Arabic when the database has an Arabic name', async () => {
    const response = await POST(lookup({ code: '3337875597197', locale: 'ar' }));
    const body = (await response.json()) as ProductLookupResponse;
    // No Arabic name in the stand-in: falls back to the English one.
    assert.ok(body.success && body.found);
    assert.equal(body.product.name, 'Foaming Cleanser');
  });
});

describe('Egyptian products (eg-drugs listing)', () => {
  it('finds a barcode only the Egyptian pharmacy listing knows, with its main active ingredients', async () => {
    const response = await POST(lookup({ code: '6221126000420' }));
    const body = (await response.json()) as ProductLookupResponse;
    assert.ok(body.success && body.found);
    assert.equal(body.product.name, 'Acnescave 0.1% topical gel 30 gm');
    assert.equal(body.product.brand, 'Biopharm Egypt');
    assert.equal(body.product.ingredientsFrom, 'egDrugs');
    assert.deepEqual(
      body.product.matches.map((m) => m.key),
      ['adapalene'],
    );
    assert.deepEqual(
      body.sources.map((s) => [s.id, s.licence]),
      [['egDrugs', 'CC BY 4.0']],
    );
  });

  it('uses the Arabic name on Arabic pages', async () => {
    const response = await POST(lookup({ code: '6221126000420', locale: 'ar' }));
    const body = (await response.json()) as ProductLookupResponse;
    assert.ok(body.success && body.found);
    assert.match(body.product.name ?? '', /^[\u0600-\u06FF]/);
  });

  it('keeps Open Beauty Facts’ name and photo and adds the Egyptian ingredients when OBF has no list', async () => {
    const response = await POST(lookup({ code: '6223008210019' }));
    const body = (await response.json()) as ProductLookupResponse;
    assert.ok(body.success && body.found);
    assert.equal(body.product.name, 'Cira Panthenol Cream');
    assert.match(body.product.image ?? '', /^data:image\/jpeg/);
    assert.deepEqual(
      body.product.matches.map((m) => m.key),
      ['panthenol', 'glycerin'],
    );
    assert.deepEqual(
      body.sources.map((s) => s.id),
      ['openBeautyFacts', 'egDrugs'],
    );
  });

  it('still answers from the Egyptian listing when Open Beauty Facts is down', async () => {
    db.failing.on = true;
    const response = await POST(lookup({ code: '6221126000420' }));
    assert.equal(response.status, 200);
    const body = (await response.json()) as ProductLookupResponse;
    assert.ok(body.success && body.found && body.product.ingredientsFrom === 'egDrugs');
  });

  it('opens a listing without a barcode by its id, and refuses unknown ids', async () => {
    let response = await POST(lookup({ id: 631 }));
    const body = (await response.json()) as ProductLookupResponse;
    assert.ok(body.success && body.found);
    assert.equal(body.product.code, null);
    assert.deepEqual(
      body.product.matches.map((m) => m.key),
      ['hyaluronicAcid', 'ceramides', 'niacinamide'],
    );
    assert.equal(db.hits.length, 0);

    response = await POST(lookup({ id: 999999999 }));
    assert.equal(response.status, 400);
  });

  it('searches the listing by English or Arabic name, maker included', async () => {
    let response = await SEARCH(lookup({ q: 'skykur cleanser' }, VALID_TOKEN, undefined, 'product-search'));
    let body = (await response.json()) as ProductSearchResponse;
    assert.ok(body.success);
    assert.ok(body.results.some((r) => r.id === 631 && !r.hasBarcode));

    response = await SEARCH(lookup({ q: 'بوباي', locale: 'ar' }, VALID_TOKEN, undefined, 'product-search'));
    body = (await response.json()) as ProductSearchResponse;
    assert.ok(body.success);
    assert.ok(body.results.some((r) => r.id === 32564));
    assert.ok(body.results.every((r) => /[\u0600-\u06FF]/.test(r.name)));

    response = await SEARCH(lookup({ q: 'zzzzqqq' }, VALID_TOKEN, undefined, 'product-search'));
    body = (await response.json()) as ProductSearchResponse;
    assert.deepEqual(body, { success: true, results: [], more: false });
  });

  it('guards the search like lookups: sign-in and a sensible query', async () => {
    let response = await SEARCH(lookup({ q: 'starville' }, 'b'.repeat(64), undefined, 'product-search'));
    assert.equal(response.status, 401);
    response = await SEARCH(lookup({ q: 'a' }, VALID_TOKEN, undefined, 'product-search'));
    assert.equal(response.status, 400);
    response = await SEARCH(lookup({ q: 42 }, VALID_TOKEN, undefined, 'product-search'));
    assert.equal(response.status, 400);
  });
});
