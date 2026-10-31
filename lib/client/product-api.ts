import type { Locale } from '../i18n';
import { messages } from '../messages';
import type { ProductLookupResponse } from '../products/types';
import { publicConfig } from '../public-config';

/**
 * Look a product up by barcode. Only the number (and the camera's reading of
 * its format) is sent. Never throws (except when aborted): failures come
 * back as `success: false`.
 */
export async function requestProduct(
  code: string,
  locale: Locale = 'en',
  format?: string,
  signal?: AbortSignal,
): Promise<ProductLookupResponse> {
  const networkFailure: ProductLookupResponse = {
    success: false,
    error: { code: 'unavailable', message: messages(locale).product.network },
  };
  try {
    const response = await fetch(`${publicConfig.apiBaseUrl}/api/product-lookup?locale=${locale}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, locale, format }),
      credentials: 'include',
      signal,
    });
    const data = (await response.json().catch(() => null)) as ProductLookupResponse | null;
    if (data && typeof data === 'object' && 'success' in data) return data;
    return networkFailure;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return networkFailure;
  }
}
