import extract from '@/data/eg-products.json';
import type { Locale } from '../i18n';
import { looksLikeSunscreen, matchIngredients, normalizeName } from './ingredients';
import type { ProductInfo, ProductSearchHit, ProductSource } from './types';

/**
 * Products sold in Egyptian pharmacies: the skincare part of the Egyptian
 * Drug Database (eg-drugs, CC BY 4.0), built by
 * scripts/import-eg-products.mjs into data/eg-products.json. It fills the
 * gap Open Beauty Facts leaves for Egypt: English and Arabic names, makers,
 * barcodes for about a quarter of the listings, and the main active
 * ingredients (not the full list from the pack). Server-only: the file stays
 * out of the browser bundle.
 */

interface EgProduct {
  id: number;
  name: string;
  ar: string;
  /** Main active ingredients, "+"-separated, lower case; may be empty. */
  active: string;
  /** "maker > Egyptian distributor". */
  company: string;
  barcode: string | null;
  category: string;
}

const PRODUCTS = extract.products as EgProduct[];

export const EG_SOURCE: ProductSource = {
  id: 'egDrugs',
  name: extract.source,
  url: extract.url,
  licence: 'CC BY 4.0',
  licenceUrl: extract.licenceUrl,
  imageLicence: null,
};

const byBarcode = new Map(PRODUCTS.filter((p) => p.barcode).map((p) => [p.barcode as string, p]));
const byId = new Map(PRODUCTS.map((p) => [p.id, p]));

/** Search text per listing: English name, Arabic name and maker, normalised like ingredient names. */
const searchIndex = PRODUCTS.map((p) => ({ product: p, words: normalizeName(`${p.name} ${p.ar} ${p.company}`).split(' ') }));

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "pierre - fabre france > biotech egypt" → "Pierre - Fabre France". */
function brandOf(company: string): string | null {
  const maker = company.split('>')[0].trim();
  return maker ? maker.replace(/(^|[\s-])([a-z])/g, (_, sep: string, letter: string) => sep + letter.toUpperCase()) : null;
}

function nameOf(product: EgProduct, locale: Locale): string {
  return locale === 'ar' && product.ar ? product.ar : sentence(product.name);
}

export function egByBarcode(code: string): EgProduct | null {
  return byBarcode.get(code) ?? null;
}

export function egById(id: number): EgProduct | null {
  return byId.get(id) ?? null;
}

/** A listing as the product check shows it; ingredients described from its active-ingredient field. */
export function egProductInfo(product: EgProduct, locale: Locale): ProductInfo {
  const { listed, matches } = matchIngredients({
    text: product.active,
    sunscreen: looksLikeSunscreen(product.name, product.category),
  });
  return {
    code: product.barcode,
    name: nameOf(product, locale),
    brand: brandOf(product.company),
    quantity: null,
    image: null,
    ingredientsText: product.active ? product.active.split('+').map((a) => a.trim()).filter(Boolean).join(', ') : null,
    ingredientsFrom: listed ? 'egDrugs' : null,
    ingredientCount: listed,
    matches,
  };
}

/**
 * Listings whose English name, Arabic name or maker has a word starting with
 * every typed word ("bobai sun", "بوباي", "starville whit"), names that start
 * with the query first. Word starts only, no fuzzy spelling, so results
 * never surprise.
 */
export function searchEgProducts(query: string, locale: Locale, limit = 12): { results: ProductSearchHit[]; more: boolean } {
  const terms = normalizeName(query).split(' ').filter(Boolean);
  if (!terms.length) return { results: [], more: false };
  const first = terms.join(' ');
  const found = searchIndex.filter(({ words }) => terms.every((t) => words.some((w) => w.startsWith(t))));
  found.sort((a, b) => {
    const aStarts = normalizeName(nameOf(a.product, locale)).startsWith(first) ? 0 : 1;
    const bStarts = normalizeName(nameOf(b.product, locale)).startsWith(first) ? 0 : 1;
    return aStarts - bStarts || a.product.name.localeCompare(b.product.name);
  });
  return {
    results: found.slice(0, limit).map(({ product }) => ({
      id: product.id,
      name: nameOf(product, locale),
      brand: brandOf(product.company),
      hasBarcode: !!product.barcode,
    })),
    more: found.length > limit,
  };
}
