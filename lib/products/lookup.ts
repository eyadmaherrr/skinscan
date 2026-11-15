import type { Locale } from '../i18n';
import { EG_SOURCE, egById, egByBarcode, egProductInfo } from './egypt';
import { lookupProduct } from './open-beauty-facts';
import type { ProductInfo, ProductSource } from './types';

export type LookupResult = { found: true; product: ProductInfo; sources: ProductSource[] } | { found: false };

/**
 * A barcode in every source, best evidence first:
 * 1. Open Beauty Facts with an ingredient list (the full list from the pack);
 * 2. the Egyptian pharmacy listing (main active ingredients), keeping Open
 *    Beauty Facts' name and photo when it knows the product without a list;
 * 3. Open Beauty Facts without ingredients.
 * When Open Beauty Facts is down, an Egyptian listing is still shown; without
 * one the error (ProductDbUnavailable) goes to the caller.
 */
export async function lookupBarcode(code: string, locale: Locale): Promise<LookupResult> {
  const eg = egByBarcode(code);
  let obf: Awaited<ReturnType<typeof lookupProduct>> = null;
  try {
    obf = await lookupProduct(code, locale);
  } catch (error) {
    if (!eg) throw error;
  }

  if (obf && obf.product.ingredientCount > 0) return { found: true, product: obf.product, sources: [obf.source] };
  if (eg) {
    const listing = egProductInfo(eg, locale);
    if (!obf) return { found: true, product: { ...listing, code }, sources: [EG_SOURCE] };
    return {
      found: true,
      product: {
        ...listing,
        code,
        // Arabic pages keep the Arabic name from the Egyptian listing.
        name: (locale === 'ar' ? listing.name : obf.product.name) ?? listing.name,
        brand: obf.product.brand ?? listing.brand,
        quantity: obf.product.quantity,
        image: obf.product.image,
      },
      sources: [obf.source, EG_SOURCE],
    };
  }
  if (obf) return { found: true, product: obf.product, sources: [obf.source] };
  return { found: false };
}

/** An Egyptian listing chosen from a name search; listings with a barcode go through lookupBarcode. */
export async function lookupEgListing(id: number, locale: Locale): Promise<LookupResult> {
  const eg = egById(id);
  if (!eg) return { found: false };
  if (eg.barcode) return lookupBarcode(eg.barcode, locale);
  return { found: true, product: egProductInfo(eg, locale), sources: [EG_SOURCE] };
}
