import { PRODUCTION_URL } from '../brand';
import type { Locale } from '../i18n';
import { looksLikeSunscreen, matchIngredients } from './ingredients';
import type { ProductInfo, ProductSource } from './types';

/**
 * Product lookups in Open Beauty Facts (https://world.openbeautyfacts.org),
 * the open cosmetics database: product data under the Open Database Licence
 * (ODbL), photos under CC BY-SA 3.0. Only the barcode number is sent, from
 * this server; the patient's browser never contacts the database. Results are
 * kept in memory for a while so repeated scans don't hit the database again
 * (this is caching, not a copy of the database).
 */

const DEFAULT_BASE = 'https://world.openbeautyfacts.org';
const IMAGE_ORIGIN = 'https://images.openbeautyfacts.org';
const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'product_name_ar',
  'brands',
  'quantity',
  'ingredients_text',
  'ingredients_text_en',
  'ingredients_tags',
  'categories_tags',
  'image_front_small_url',
].join(',');
// Open Beauty Facts asks API users to identify their app.
const USER_AGENT = `SkinScanByDrMaher/1.0 (+${PRODUCTION_URL})`;
const LOOKUP_TIMEOUT_MS = 6000;
const IMAGE_TIMEOUT_MS = 4000;
const MAX_IMAGE_BYTES = 150 * 1024;
const MAX_INGREDIENTS_TEXT = 4000;
const FOUND_TTL_MS = 12 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 60 * 60 * 1000;
const MAX_CACHED = 500;

/** The database's base URL (SKINSCAN_PRODUCT_DB_URL points tests at a stand-in). */
function baseUrl(): string {
  return (process.env.SKINSCAN_PRODUCT_DB_URL || DEFAULT_BASE).replace(/\/+$/, '');
}

export class ProductDbUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductDbUnavailable';
  }
}

interface RawProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  product_name_ar?: string;
  brands?: string;
  quantity?: string;
  ingredients_text?: string;
  ingredients_text_en?: string;
  ingredients_tags?: string[];
  categories_tags?: string[];
  image_front_small_url?: string;
}

/** What is cached per barcode: everything except the language-dependent name choice. */
interface Entry {
  expires: number;
  product: (Omit<ProductInfo, 'name'> & { names: { en: string | null; ar: string | null; any: string | null } }) | null;
  imageLicence: ProductSource['imageLicence'];
}

const globalCache = globalThis as unknown as { __skinScanProducts?: Map<string, Entry> };
const cache = (globalCache.__skinScanProducts ??= new Map<string, Entry>());

/** Test helper. */
export function clearProductCache(): void {
  cache.clear();
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

/** The front-of-pack photo as a data: URL, or null (never fails the lookup). */
async function fetchImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // Only the database's own image server (or the configured stand-in in tests).
  if (parsed.origin !== IMAGE_ORIGIN && parsed.origin !== new URL(baseUrl()).origin) return null;
  try {
    const response = await fetch(parsed, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) return null;
    if (Number(response.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

async function fetchEntry(code: string): Promise<Entry> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/api/v2/product/${code}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ProductDbUnavailable(error instanceof Error ? error.name : 'fetch failed');
  }
  const body = (await response.json().catch(() => null)) as { status?: number; product?: RawProduct } | null;
  // Unknown barcodes come back as status 0 (with HTTP 200 or 404).
  if (body && body.status === 0 && (response.ok || response.status === 404)) {
    return { expires: Date.now() + NOT_FOUND_TTL_MS, product: null, imageLicence: null };
  }
  if (!response.ok || !body || body.status !== 1 || !body.product) {
    throw new ProductDbUnavailable(`HTTP ${response.status}`);
  }

  const raw = body.product;
  const names = { en: text(raw.product_name_en), ar: text(raw.product_name_ar), any: text(raw.product_name) };
  const ingredientsText = text(raw.ingredients_text_en) ?? text(raw.ingredients_text);
  const { listed, matches } = matchIngredients({
    text: ingredientsText,
    tags: strings(raw.ingredients_tags),
    sunscreen: looksLikeSunscreen(names.en, names.any, ...strings(raw.categories_tags)),
  });
  const image = await fetchImage(text(raw.image_front_small_url));
  return {
    expires: Date.now() + FOUND_TTL_MS,
    imageLicence: image ? 'CC BY-SA 3.0' : null,
    product: {
      code,
      names,
      brand: text(raw.brands)?.split(',')[0].trim() || null,
      quantity: text(raw.quantity),
      image,
      ingredientsText: ingredientsText ? ingredientsText.slice(0, MAX_INGREDIENTS_TEXT) : null,
      ingredientCount: listed,
      matches,
    },
  };
}

/**
 * Looks up a normalised barcode (see lib/products/barcode.ts). Null when the
 * database doesn't know the product; throws ProductDbUnavailable when the
 * database can't be reached or answers with something unexpected.
 */
export async function lookupProduct(
  code: string,
  locale: Locale,
): Promise<{ product: ProductInfo; source: ProductSource } | null> {
  const now = Date.now();
  let entry = cache.get(code);
  if (!entry || entry.expires <= now) {
    entry = await fetchEntry(code);
    cache.delete(code);
    cache.set(code, entry);
    // Oldest first: drop the oldest entries once the cache is full.
    while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
  }
  if (!entry.product) return null;

  const { names, ...rest } = entry.product;
  const name = (locale === 'ar' ? names.ar : null) ?? names.en ?? names.any;
  return {
    product: { ...rest, name },
    source: {
      name: 'Open Beauty Facts',
      url: `https://world.openbeautyfacts.org/product/${code}`,
      licence: 'ODbL',
      imageLicence: entry.imageLicence,
    },
  };
}
