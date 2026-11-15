# Product check (barcode scanner)

A patient scans the barcode of a skincare product with the phone camera,
types the number, or types the product's name (English or Arabic) at
`/products` (`/ar/products`) and sees the product's well-established
ingredients and what they are **commonly used for**. It describes
ingredients; it never says the product works, how well, or for whom. Added
1 November 2026; Egyptian products added 15 November 2026.

Decisions (owner):

- 2026-11-01: product data from **Open Beauty Facts**; "what it helps with"
  decided from a **cited ingredient table**; **not linked** to the patient's
  skin-scan results.
- 2026-11-15: Egypt is the main market, so add every useful Egyptian source
  and **switch the Egyptian pharmacy listing (eg-drugs) on**, accepting its
  provenance and data-quality risks (below).

## Sources

| Source | What it gives | Used for | Licence |
|---|---|---|---|
| **Open Beauty Facts** (world.openbeautyfacts.org), live by barcode | name, brand, photo, full ingredient list from the pack (crowd-edited) | first choice when it has an ingredient list | ODbL 1.0; photos CC BY-SA 3.0 |
| **Egyptian pharmacy listing**: the skincare part of the Egyptian Drug Database ("eg-drugs", github.com/mahmoudfalous/eg-drugs), bundled as `data/eg-products.json` | 2,933 products sold in Egyptian pharmacies: English and Arabic names, maker, **main active ingredients only**, barcodes for 660 | barcodes Open Beauty Facts lacks or has without ingredients; **name search** | CC BY 4.0 |
| **Egyptian Drug Authority** register (eservices.edaegypt.gov.eg) | whether a cosmetic is registered | a link only: "choose Cosmetics and type the trade name" (the search asks for a code, so it can't be queried) | — |

What was checked and not used (15 November 2026): Open Beauty Facts has only
254 products tagged as sold in Egypt (15 with ingredients); UPCitemdb found
0 of 6 Egyptian barcodes; Open Food Facts / Open Products Facts had none of
them; GS1 Egypt ("Verified by GS1") gives names but no ingredients and its
API is sold through membership; commercial ingredient APIs (INCI API, The
Beauty API) need a paid account and an Egyptian-coverage trial; Egyptian
pharmacy apps have no public API.

### Order for a barcode (`lib/products/lookup.ts`)

1. Open Beauty Facts with an ingredient list → that.
2. Otherwise the Egyptian listing, if it has the barcode — keeping Open
   Beauty Facts' name and photo when OBF knows the product without a list
   (Arabic pages keep the listing's Arabic name).
3. Otherwise Open Beauty Facts without ingredients.
4. Otherwise "not found". When Open Beauty Facts is down, an Egyptian listing
   is still shown.

### Name search

`POST /api/product-search { q, locale }` searches the Egyptian listing only
(local file, nothing leaves the server): every typed word must start a word
of the English name, the Arabic name or the maker; names starting with the
query come first; 12 results. Arabic spelling variants are folded (see
`normalizeName`). Choosing a result calls `/api/product-lookup { id }`; a
listing with a barcode goes through the barcode order above.

### The Egyptian listing: how it is built, and its risks

`node scripts/import-eg-products.mjs` downloads eg-drugs at a pinned commit
and keeps skincare categories only (skin care, sun, whitening, moisturising,
acne, cleansing, soothing, scar, eye contour…). It leaves out medicines
(antibiotics, corticosteroids, antifungals, isotretinoin, minoxidil and
other drug classes), hair, oral and intimate products, the prices and the
"uses" text (indications are medical claims we don't repeat), and invalid or
duplicate barcodes. Change the pinned commit to refresh.

Risks the owner accepted (2026-11-15):

- **Provenance.** The data was collected from an unnamed Egyptian pharmacy
  website; the author removed the `source` field on 2026-10-30 and earlier
  versions said "commercial usage may require separate permission". It is
  now published as CC BY 4.0. Contact: the author's address in the eg-drugs
  README.
- **Quality.** Active ingredients are sometimes wrong or missing (e.g. a
  Bioderma moisturiser listed as "nigella sativa oil"); only ~25 % of
  listings have barcodes; imported brands often have none. The result says
  "the pharmacy listing names only the main active ingredients and may be
  incomplete or out of date. Check the pack", labels the list "Main
  ingredients in the pharmacy listing", and each ingredient "In the pharmacy
  listing as …" (not "on the pack").
- Some listings are pharmacy products with drug actives that remain after
  the filter (e.g. adapalene, tretinoin gels); they are described only
  through the cited table, like any other product.

## Flow

```mermaid
flowchart LR
  P[Phone camera] -->|frames stay in the browser| D{BarcodeDetector?}
  D -->|native: Chrome Android, Edge, Samsung| R[barcode number]
  D -->|none: Safari on iPhone| Z[ZXing WebAssembly\n/vendor/zxing_reader.wasm] --> R
  T[Typed number or name] -->|digits| R
  T -->|letters| Q[POST /api/product-search] --> EG
  R -->|POST /api/product-lookup\n{code, locale, format} or {id}| S[SkinScan server]
  S -->|GET /api/v2/product/CODE.json| OBF[(Open Beauty Facts)]
  S -->|front photo, ≤150 KB| IMG[images.openbeautyfacts.org]
  S --> EG[(data/eg-products.json\nEgyptian pharmacy listing)]
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
  and the text field. No frame or photo leaves the device.
- **One text field** ("Barcode number or product name"): digits (with
  spaces or dashes) are a barcode — check digit validated in the browser and
  again on the server (`lib/products/barcode.ts`); UPC-A becomes a 13-digit
  GTIN, UPC-E is expanded, EAN-8 stays 8 digits — anything else of 2+
  characters is a name search.
- **Sign-in**: like photo scans, a signed-in patient is required when
  `SKINSCAN_REQUIRE_AUTH` is on; the pressed action (camera, lookup or
  search) continues after signing in through the pop-up.

## API

Both routes share `lib/products/api.ts`: same order as `/api/skin-scan` —
rate limit (one bucket for both, `product:<hashed IP>`,
`SKINSCAN_PRODUCT_RATE_LIMIT` = 60 per `SKIN_SCAN_RATE_LIMIT_WINDOW_SECONDS`)
→ sign-in → JSON body ≤ 1 KB. Always `Cache-Control: no-store`. Barcodes and
search text travel in the body, not the URL, and are never logged.

`POST /api/product-lookup[?locale=ar]` — `{ "code": "3337875597197",
"format"?: "upc_e" }` or `{ "id": 631 }` (an Egyptian listing), plus
`"locale"?: "ar"`.

| Outcome | HTTP | Body |
|---|---|---|
| Found | 200 | `{success:true, found:true, product:{code, name, brand, quantity, image, ingredientsText, ingredientsFrom, ingredientCount, matches[]}, sources:[{id, name, url, licence, licenceUrl, imageLicence}]}` |
| Not in any source | 200 | `{success:true, found:false, code}` |
| `unauthenticated` | 401 | `{success:false, error:{code, message}}` (message in the requested language) |
| `invalid_request` (incl. unknown `id`) / `invalid_barcode` | 400 | 〃 |
| `rate_limited` | 429 + `Retry-After` | 〃 |
| `unavailable` (Open Beauty Facts down and no Egyptian listing) | 503 + `Retry-After: 30` | 〃 |

`POST /api/product-search[?locale=ar]` — `{ "q": "starville" }` (2–60
characters) → `{success:true, results:[{id, name, brand, hasBarcode}], more}`;
same error shapes.

`ingredientsFrom` is `openBeautyFacts` (full list from the pack), `egDrugs`
(main actives from the pharmacy listing) or null. `code` is null for a
listing without a barcode. `matches[]` items: `{key, asListed, benefits[],
sources[{label, url}]}` in listed order. `ingredientCount: 0` means there is
no ingredient list. Text comes from `lib/messages.ts` (`product.*`) in
English or Arabic.

Open Beauty Facts lookups are cached in memory per server instance (found
12 h, not found 1 h, at most 500 barcodes; errors are not cached).

## Open Beauty Facts

- Product data: Open Database Licence (ODbL 1.0); photos: CC BY-SA 3.0.
  Every result names each source with its link and licence, and credits the
  photo when one is shown (ODbL's notice for works produced from the data).
  Only the short-lived lookup cache above is kept. Storing or publishing an
  extract of OBF data would bring in ODbL share-alike for that extract
  (Rosheta's `data/skincare-products.json` on the website is such an
  extract); decide licensing with the owner before doing that here.
- Requests send a `User-Agent` naming SkinScan, as Open Beauty Facts asks.
  Fields read include `ingredients_text_ar` (an Arabic-only list is used
  when there is no Latin one).
- The front photo is fetched by the server (only from
  `images.openbeautyfacts.org`, image types only, ≤ 150 KB) and sent to the
  browser as a `data:` URL, so the patient's browser never contacts Open
  Beauty Facts and the CSP needs no new origin.
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
| Niacinamide (vitamin B3) | redness, uneven tone, skin barrier | Wohlrab & Kreft 2014; Hakozaki 2002 |
| Vitamin C (ascorbic acid and stable derivatives) | uneven tone, fine lines | Al-Niaimi & Chiang 2017 |
| Retinoids (retinol, retinal, tretinoin) | rough texture, fine lines | Mukherjee 2006 |
| AHAs (glycolic, lactic, mandelic) | rough texture, uneven tone | Tang & Yang 2018 |
| UV filters (EU Annex VI names and US names) | sun protection | Regulation (EC) 1223/2009 Annex VI |
| Titanium dioxide, zinc oxide | sun protection — **only** in a product labelled as a sunscreen (SPF / sunscreen in name or category) or with another UV filter, because both are also make-up colourants and nappy-cream ingredients | Annex VI |
| Hyaluronic acid / hyaluronates, urea | hydration | Purnamawati 2017 |
| Glycerin | hydration | Fluhr 2008 |
| Ceramides | skin barrier | Purnamawati 2017 |
| Panthenol (provitamin B5) | skin barrier, hydration | Proksch 2017 |

Matching is by whole ingredient name after normalisation (case, accents,
punctuation, percentages; Arabic hamza/taa marbuta/alef maqsura, diacritics
and Arabic-Indic digits). Each ingredient also has its common Arabic names
(نياسيناميد, حمض الهيالورونيك, جلسرين, أكسيد الزنك…). Lists may be separated
by commas, Arabic commas, semicolons, slashes, brackets or "+" (pharmacy
listings); a leading delivery-form word ("liposomal", "encapsulated"…) is
ignored. Groups such as hyaluronates and ceramides match by stem.
"Ethylhexyl salicylate" is not salicylic acid; "retinyl palmitate" and
"ascorbyl palmitate" are not described (weak evidence or present as
preservatives). Database tags fill in names the text lacks.

### Rules (business rules for this feature)

- Informational only: "not medical advice" sits under the product name,
  before any description; every description says "commonly used for".
- Describes ingredients, not the product: a note says the amount and
  whether it is rinsed off change what it can do; for the pharmacy listing a
  second note says it names main actives only and may be incomplete.
- No fabricated results: no ingredient list → "No ingredient list
  available", nothing described; ingredients but none in the table → says
  so and that this doesn't mean the product does nothing; not found → says
  so (and, for a 622 barcode, that it was issued in Egypt and Egyptian
  products are often missing from open databases).
- The Egyptian Drug Authority link is a pointer; SkinScan never says a
  product is or isn't registered.
- Adding an ingredient needs a checked source in the table, names in
  `product.ingredients` (EN and AR) and a test in `tests/products.test.ts`.
- Not linked to skin-scan results (owner decision 2026-11-01), so it never
  reads as a personal recommendation.

## UX (docs/UX_RULES.md)

One primary action per screen: "Scan a barcode" on the start screen, "Book
a consultation" on a result, "Check another product" on not-found (it
returns to an empty, focused field). The "Look up" button disables and says
"Looking up…"; failures appear under the field (G9). Search results are
44 px+ buttons with name, maker and "Listed without a barcode" where
relevant. Answer first on a result: benefits summary, then ingredients, then
the full list, sources, attribution and the EDA pointer. Logical properties
for RTL; barcodes stay left-to-right and names use `dir="auto"` inside
Arabic text.

## Tests

`tests/products.test.ts` (barcode check digits and UPC-E, splitting,
matching, Arabic spellings, "+" lists and delivery-form words, mineral
filters, no-list behaviour, both languages name every ingredient and
benefit) and `tests/product-api.test.ts` (sign-in, found, only the barcode
sent and caching, not found, no list, photos only from the database's image
host, invalid input, database down not cached; Egyptian barcode only in the
listing, Arabic names, OBF name + Egyptian ingredients, Egyptian answer while
OBF is down, lookup by id, English and Arabic name search, search guards).
