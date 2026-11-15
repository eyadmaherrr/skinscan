import { NextResponse } from 'next/server';
import { failure, log, NO_STORE, readProductRequest } from '@/lib/products/api';
import { normalizeBarcode } from '@/lib/products/barcode';
import { lookupBarcode, lookupEgListing, type LookupResult } from '@/lib/products/lookup';
import { ProductDbUnavailable } from '@/lib/products/open-beauty-facts';
import type { ProductLookupResponse } from '@/lib/products/types';

export const runtime = 'nodejs';
export const maxDuration = 20;

const EVENT = 'product_lookup';

/**
 * POST { code: "3337875597197", locale?: "ar", format?: "upc_e" } looks a
 * skincare product up by barcode in Open Beauty Facts and the Egyptian
 * pharmacy listing; POST { id: 1234 } opens an Egyptian listing chosen from
 * /api/product-search. Describes the product's well-established ingredients
 * (docs/PRODUCT_SCAN.md). The barcode travels in the body, not the URL, so it
 * stays out of access logs.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();
  const read = await readProductRequest(request, EVENT, startedAt);
  if ('response' in read) return read.response;
  const { body, locale } = read;

  let code: string | null = null;
  let lookup: () => Promise<LookupResult>;
  if (typeof body.id === 'number' && Number.isInteger(body.id) && body.id > 0) {
    const id = body.id;
    lookup = () => lookupEgListing(id, locale);
  } else if (typeof body.code === 'string' && body.code.length <= 32) {
    code = normalizeBarcode(body.code, typeof body.format === 'string' ? body.format : undefined);
    if (!code) {
      log(EVENT, 'invalid_barcode', startedAt);
      return failure('invalid_barcode', locale);
    }
    const valid = code;
    lookup = () => lookupBarcode(valid, locale);
  } else {
    return failure('invalid_request', locale);
  }

  try {
    const result = await lookup();
    if (!result.found) {
      log(EVENT, 'not_found', startedAt);
      if (!code) return failure('invalid_request', locale);
      const notFound: ProductLookupResponse = { success: true, found: false, code };
      return NextResponse.json(notFound, { headers: NO_STORE });
    }
    log(EVENT, 'found', startedAt, {
      sources: result.sources.map((s) => s.id),
      ingredients: result.product.ingredientsFrom,
      described: result.product.matches.length,
    });
    const found: ProductLookupResponse = { success: true, found: true, product: result.product, sources: result.sources };
    return NextResponse.json(found, { headers: NO_STORE });
  } catch (error) {
    log(EVENT, 'unavailable', startedAt, { reason: error instanceof ProductDbUnavailable ? error.message : 'error' });
    return failure('unavailable', locale, { 'Retry-After': '30' });
  }
}
