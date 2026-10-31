# Product check (barcode scanner)

A patient scans the barcode of a skincare product with the phone camera (or
types the number) at `/products` (`/ar/products`) and sees the product's
well-established ingredients and what they are **commonly used for**. It
describes ingredients; it never says the product works, how well, or for
whom. Added 1 November 2026.

Decisions (owner, 2026-11-01): product data from **Open Beauty Facts** only;
"what it helps with" decided from a **cited ingredient table**; **not linked**
to the patient's skin-scan results.

## Flow

```mermaid
flowchart LR
  P[Phone camera] -->|frames stay in the browser| D{BarcodeDetector?}
  D -->|native: Chrome Android, Edge, Samsung| R[barcode number]
  D -->|none: Safari on iPhone| Z[ZXing WebAssembly\n/vendor/zxing_reader.wasm] --> R
  T[Typed number] --> R
  R -->|POST /api/product-lookup\n{code, locale, format}| S[SkinScan server]
  S -->|GET /api/v2/product/CODE.json| OBF[(Open Beauty Facts)]
  S -->|front photo, ≤150 KB| IMG[images.openbeautyfacts.org]
  S --> M[lib/products/ingredients.ts\ncited table] --> C[Result card]
```

- **Camera** (`components/BarcodeScanner.tsx`): back camera, EAN-13, EAN-8,
  UPC-A, UPC-E. Uses the browser's `BarcodeDetector` when it reads those
  formats, otherwise the `barcode-detector` ponyfill (ZXing-C++ compiled to
  WebAssembly). Its `.wasm` file is copied from `node_modules` to
  `public/vendor/` by `scripts/copy-barcode-wasm.mjs` (runs before `dev` and
  `build`; not committed) and served from this site, never from a CDN. The
  production CSP allows `'wasm-unsafe-eval'` for it. Camera refused, no
  camera, camera busy, insecure page or no reader → a message saying why,
  and the number field. No frame or photo leaves the device.
- **Number field**: always shown. The check digit is validated in the
  browser and again on the server (`lib/products/barcode.ts`); UPC-A becomes
  a 13-digit GTIN, UPC-E is expanded, EAN-8 stays 8 digits (the form Open
  Beauty Facts stores).
- **Sign-in**: like photo scans, a signed-in patient is required when
  `SKINSCAN_REQUIRE_AUTH` is on; the pressed action continues after signing
  in through the pop-up.

## API

`POST /api/product-lookup[?locale=ar]` — JSON `{ "code": "3337875597197",
"locale"?: "ar", "format"?: "upc_e" }`. The barcode is in the body, not the
URL, so it stays out of access logs. Order in the route (same pattern as
`/api/skin-scan`): rate limit (own bucket `product:<hashed IP>`,
`SKINSCAN_PRODUCT_RATE_LIMIT` = 30 per `SKIN_SCAN_RATE_LIMIT_WINDOW_SECONDS`)
→ sign-in → body checks → barcode validation → lookup. Always
`Cache-Control: no-store`.

| Outcome | HTTP | Body |
|---|---|---|
| Found | 200 | `{success:true, found:true, product:{code, name, brand, quantity, image, ingredientsText, ingredientCount, matches[]}, source:{name, url, licence:"ODbL", imageLicence}}` |
| Not in the database | 200 | `{success:true, found:false, code}` |
| `unauthenticated` | 401 | `{success:false, error:{code, message}}` (message in the requested language) |
| `invalid_request` / `invalid_barcode` | 400 | 〃 |
| `rate_limited` | 429 + `Retry-After` | 〃 |
| `unavailable` (database down or unexpected answer) | 503 + `Retry-After: 30` | 〃 |

`matches[]` items: `{key, asListed, benefits[], sources[{label, url}]}` in the
order the product lists them. `ingredientCount: 0` means there is no
ingredient list. Names, benefits and ingredient names are shown from
`lib/messages.ts` (`product.*`) in English or Arabic.

Lookups are cached in memory per server instance (found 12 h, not found
1 h, at most 500 barcodes; errors are not cached). This is caching, not a
copy of the database.

## Open Beauty Facts

- Product data: Open Database Licence (ODbL 1.0); photos: CC BY-SA 3.0.
  Every result names the source with a link to the product's page and the
  licence, and credits the photo when one is shown (ODbL's notice for
  works produced from the data). Only the short-lived lookup cache above is
  kept. Storing or publishing an extract of the data (e.g. a clinic product
  list built from it) would bring in ODbL share-alike for that extract, and
  Rosheta's `data/skincare-products.json` on the website is such an extract;
  decide licensing with the owner before doing the same here.
- Requests send a `User-Agent` naming SkinScan, as Open Beauty Facts asks.
- The front photo is fetched by the server (only from
  `images.openbeautyfacts.org`, image types only, ≤ 150 KB) and sent to the
  browser as a `data:` URL, so the patient's browser never contacts Open
  Beauty Facts and the CSP needs no new origin.
- It is crowd-edited: the result says so and asks the patient to check the
  pack. Coverage of products sold in Egypt is thin; unknown barcodes get a
  plain "not found" with a link to contribute the product — nothing is
  guessed.
- `SKINSCAN_PRODUCT_DB_URL` points the lookup elsewhere (tests use a local
  stand-in). Default `https://world.openbeautyfacts.org`.

## The ingredient table (`lib/products/ingredients.ts`)

Only well-established ingredients, each with sources checked on PubMed or
EUR-Lex (links in the file and in the app's "Sources" section):

| Ingredient (group) | Commonly used for | Source |
|---|---|---|
| Salicylic acid | blemishes, clogged pores | Zaenglein 2016 (AAD acne guideline) |
| Benzoyl peroxide, adapalene | blemishes | Zaenglein 2016 |
| Azelaic acid | blemishes, redness, uneven tone | Fitton & Goa 1991; Thiboutot 2020 |
| Niacinamide | redness, uneven tone, skin barrier | Wohlrab & Kreft 2014; Hakozaki 2002 |
| Vitamin C (ascorbic acid and stable derivatives) | uneven tone, fine lines | Al-Niaimi & Chiang 2017 |
| Retinoids (retinol, retinal, tretinoin) | rough texture, fine lines | Mukherjee 2006 |
| AHAs (glycolic, lactic, mandelic) | rough texture, uneven tone | Tang & Yang 2018 |
| UV filters (EU Annex VI names and US names) | sun protection | Regulation (EC) 1223/2009 Annex VI |
| Titanium dioxide, zinc oxide | sun protection — **only** in a product labelled as a sunscreen (SPF / sunscreen in name or category) or with another UV filter, because both are also make-up colourants | Annex VI |
| Hyaluronic acid / hyaluronates, urea | hydration | Purnamawati 2017 |
| Glycerin | hydration | Fluhr 2008 |
| Ceramides | skin barrier | Purnamawati 2017 |
| Panthenol | skin barrier, hydration | Proksch 2017 |

Matching is by whole ingredient name after normalisation (case, accents,
punctuation, percentages); groups such as hyaluronates and ceramides match
by stem. "Ethylhexyl salicylate" is not salicylic acid; "retinyl palmitate"
and "ascorbyl palmitate" are not described (weak evidence or present as
preservatives). Database tags fill in names the text lacks.

### Rules (business rules for this feature)

- Informational only: "not medical advice" sits under the product name,
  before any description; every description says "commonly used for".
- Describes ingredients, not the product: a note says the amount and
  whether it is rinsed off change what it can do.
- No fabricated results: no ingredient list → "No ingredient list
  available", nothing described; ingredients but none in the table → says
  so and that this doesn't mean the product does nothing; not found → says
  so.
- Adding an ingredient needs a checked source in the table, names in
  `product.ingredients` (EN and AR) and a test in `tests/products.test.ts`.
- Not linked to skin-scan results (owner decision 2026-11-01), so it never
  reads as a personal recommendation.

## UX (docs/UX_RULES.md)

One primary action per screen: "Scan a barcode" on the start screen, "Book
a consultation" on a result, "Check another product" on not-found. The
"Look up" button disables and says "Looking up…"; failures appear under the
field (G9). Answer first on a result: benefits summary, then ingredients,
then the full list, sources and attribution. Targets ≥ 44 px, logical
properties for RTL, the barcode and ingredient names stay left-to-right
inside Arabic text.

## Tests

`tests/products.test.ts` (barcode check digits and UPC-E, splitting,
matching, mineral filters, no-list behaviour, both languages name every
ingredient and benefit) and `tests/product-api.test.ts` (sign-in, found,
only the barcode sent and caching, not found, no list, photos only from the
database's image host, invalid input, database down not cached).
