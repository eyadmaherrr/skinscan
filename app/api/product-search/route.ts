import { NextResponse } from 'next/server';
import { failure, log, NO_STORE, readProductRequest } from '@/lib/products/api';
import { searchEgProducts } from '@/lib/products/egypt';
import type { ProductSearchResponse } from '@/lib/products/types';

export const runtime = 'nodejs';

const EVENT = 'product_search';

/**
 * POST { q: "starville", locale?: "ar" } — Egyptian pharmacy listings whose
 * English or Arabic name or maker matches the typed words (up to 12), for
 * products whose barcode is missing or not found (docs/PRODUCT_SCAN.md).
 * Searches the local list only; nothing leaves the server. The text is in
 * the body and is not logged.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();
  const read = await readProductRequest(request, EVENT, startedAt);
  if ('response' in read) return read.response;
  const { body, locale } = read;

  const q = typeof body.q === 'string' ? body.q.trim() : '';
  if (q.length < 2 || q.length > 60) return failure('invalid_request', locale);

  const { results, more } = searchEgProducts(q, locale);
  log(EVENT, results.length ? 'found' : 'none', startedAt, { results: results.length });
  const response: ProductSearchResponse = { success: true, results, more };
  return NextResponse.json(response, { headers: NO_STORE });
}
