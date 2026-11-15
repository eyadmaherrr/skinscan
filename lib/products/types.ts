import type { IngredientMatch } from './ingredients';

/** POST /api/product-lookup and /api/product-search — the response contracts (docs/PRODUCT_SCAN.md). */

export type ProductSourceId = 'openBeautyFacts' | 'egDrugs';

export interface ProductSource {
  id: ProductSourceId;
  name: string;
  /** The product's page (Open Beauty Facts) or the dataset's home (eg-drugs). */
  url: string;
  /** Licence of the product data. */
  licence: 'ODbL' | 'CC BY 4.0';
  licenceUrl: string;
  /** Licence of the product photo, when this source supplied one. */
  imageLicence: 'CC BY-SA 3.0' | null;
}

export interface ProductInfo {
  /** The barcode as looked up (EAN-8 or 13-digit GTIN); null for an Egyptian listing found by name that has none. */
  code: string | null;
  name: string | null;
  brand: string | null;
  quantity: string | null;
  /** The front-of-pack photo as a data: URL (fetched by the server, so the browser never contacts the database). */
  image: string | null;
  /** The ingredient list as published, or null when no source has one. */
  ingredientsText: string | null;
  /**
   * Where the ingredients come from: Open Beauty Facts has the full list from
   * the pack; the Egyptian pharmacy listing (eg-drugs) names main active
   * ingredients only. Null when there are none.
   */
  ingredientsFrom: ProductSourceId | null;
  /** Ingredient names read from the list; 0 means there is no list to describe. */
  ingredientCount: number;
  /** Ingredients from the cited table (lib/products/ingredients.ts), in label order. */
  matches: IngredientMatch[];
}

export type ProductErrorCode = 'unauthenticated' | 'invalid_request' | 'invalid_barcode' | 'rate_limited' | 'unavailable';

export type ProductFailure = { success: false; error: { code: ProductErrorCode; message: string } };

export type ProductLookupResponse =
  | { success: true; found: true; product: ProductInfo; sources: ProductSource[] }
  | { success: true; found: false; code: string }
  | ProductFailure;

/** One Egyptian listing matching a typed name. */
export interface ProductSearchHit {
  /** The listing's id in data/eg-products.json; looked up with { id } . */
  id: number;
  name: string;
  brand: string | null;
  hasBarcode: boolean;
}

export type ProductSearchResponse = { success: true; results: ProductSearchHit[]; more: boolean } | ProductFailure;
