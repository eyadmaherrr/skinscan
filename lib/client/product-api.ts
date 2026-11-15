import type { Locale } from '../i18n';
import { messages } from '../messages';
import type { ProductFailure, ProductLookupResponse, ProductSearchResponse } from '../products/types';
import { publicConfig } from '../public-config';

/** What to look up: a barcode (with the camera's reading of its format) or an Egyptian listing picked from a name search. */
export type ProductQuery = { code: string; format?: string } | { id: number };

async function post<T extends { success: boolean }>(path: string, body: object, locale: Locale, signal?: AbortSignal): Promise<T | ProductFailure> {
  const networkFailure: ProductFailure = {
    success: false,
    error: { code: 'unavailable', message: messages(locale).product.network },
  };
  try {
    const response = await fetch(`${publicConfig.apiBaseUrl}${path}?locale=${locale}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, locale }),
      credentials: 'include',
      signal,
    });
    const data = (await response.json().catch(() => null)) as T | null;
    if (data && typeof data === 'object' && 'success' in data) return data;
    return networkFailure;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return networkFailure;
  }
}

/**
 * Look a product up. Only the barcode number (or the listing's id) is sent.
 * Never throws (except when aborted): failures come back as `success: false`.
 */
export function requestProduct(query: ProductQuery, locale: Locale = 'en', signal?: AbortSignal): Promise<ProductLookupResponse> {
  return post<ProductLookupResponse>('/api/product-lookup', query, locale, signal);
}

/** Egyptian pharmacy listings matching a typed name (English or Arabic). Never throws, as above. */
export function searchProducts(q: string, locale: Locale = 'en', signal?: AbortSignal): Promise<ProductSearchResponse> {
  return post<ProductSearchResponse>('/api/product-search', { q }, locale, signal);
}
