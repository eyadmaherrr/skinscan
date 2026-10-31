import type { IngredientMatch } from './ingredients';

/** POST /api/product-lookup — the response contract (docs/PRODUCT_SCAN.md). */

export interface ProductSource {
  name: 'Open Beauty Facts';
  /** The product's page on Open Beauty Facts. */
  url: string;
  /** Licence of the product data. */
  licence: 'ODbL';
  /** Licence of the product photo, when there is one. */
  imageLicence: 'CC BY-SA 3.0' | null;
}

export interface ProductInfo {
  /** The barcode as looked up (EAN-8 or 13-digit GTIN). */
  code: string;
  name: string | null;
  brand: string | null;
  quantity: string | null;
  /** The front-of-pack photo as a data: URL (fetched by the server, so the browser never contacts the database). */
  image: string | null;
  /** The ingredient list as published, or null when the database has none. */
  ingredientsText: string | null;
  /** Ingredient names read from the list; 0 means there is no list to describe. */
  ingredientCount: number;
  /** Ingredients from the cited table (lib/products/ingredients.ts), in label order. */
  matches: IngredientMatch[];
}

export type ProductErrorCode = 'unauthenticated' | 'invalid_request' | 'invalid_barcode' | 'rate_limited' | 'unavailable';

export type ProductLookupResponse =
  | { success: true; found: true; product: ProductInfo; source: ProductSource }
  | { success: true; found: false; code: string }
  | { success: false; error: { code: ProductErrorCode; message: string } };
