/**
 * Builds data/eg-products.json: the skincare part of the Egyptian Drug
 * Database ("eg-drugs", https://github.com/mahmoudfalous/eg-drugs, data under
 * CC BY 4.0), products sold in Egyptian pharmacies with English and Arabic
 * names, makers, main active ingredients and barcodes. The product check
 * (docs/PRODUCT_SCAN.md) uses it after Open Beauty Facts, which knows few
 * Egyptian products.
 *
 * Kept: skincare, sun, whitening, moisturising, acne, cleansing and soothing
 * categories. Left out: medicines (antibiotics, corticosteroids, antifungals
 * and other drug classes), hair, oral and intimate products, and the
 * dataset's prices and "uses" text (indications are medical claims we don't
 * repeat). Barcodes are kept only when their check digit is valid.
 *
 * Pinned to one commit so a rebuild gives the same file; to refresh, change
 * COMMIT and run:
 *
 *   node scripts/import-eg-products.mjs
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const COMMIT = '64660b26950a13289d43107a42e4b075bbb73be5'; // 2026-11-02
const SOURCE = `https://raw.githubusercontent.com/mahmoudfalous/eg-drugs/${COMMIT}/data/eg_drugs.json`;
const OUT = path.join(process.cwd(), 'data', 'eg-products.json');

const SKIN = /^(skin|sun ?(block|screen)|sunblock|sunscreen|whiten|moistur|emollient|anti[- ]?acne|acne|facial|face serum|soap|sooth|firming|anti-wrinkle|eye contour|scar|anti[- ]?scar|lip care|body lotion|cosmetic|healing|wound healing)/;
const NOT_SKINCARE =
  /antibiotic|corticoid|steroid|antifung|antivir|analgesic|nsaid|anti-?inflam|antihyper|antimuscarinic|antineoplastic|supplement|support|lubricant|eye drops|eye surgery|vaginal|intimate|mouth|hair|dermatological drugs|pde-4|massage/;
/** Medicines that turn up in "skin care" or "acne" rows: these products are left out entirely. */
const DRUG_ACTIVES =
  /erythromycin|clindamycin|fusidic|mupirocin|neomycin|gentamicin|bacitracin|nadifloxacin|metronidazole|hydrocortisone|betamethasone|clobetasol|mometasone|fluocinolone|fluocinonide|triamcinolone|dexamethasone|prednisolone|desonide|ketoconazole|clotrimazole|miconazole|terbinafine|isoconazole|econazole|sertaconazole|tacrolimus|pimecrolimus|isotretinoin|minoxidil|silver sulfadiazine/;

/** GS1 check digit (same rule as lib/products/barcode.ts). */
function validGtin(code) {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  let sum = 0;
  for (let i = code.length - 2, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(code[i]) * w;
  return (10 - (sum % 10)) % 10 === Number(code[code.length - 1]);
}

/** As lib/products/barcode.ts stores it: EAN-8 as 8 digits, the rest as 13-digit GTINs. */
function storedForm(code) {
  if (code.length === 8) return code;
  if (code.length === 12) return `0${code}`;
  if (code.length === 14) return code.startsWith('0') ? code.slice(1) : null;
  return code;
}

const clean = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`eg-drugs download failed: HTTP ${response.status}`);
const rows = await response.json();

const products = [];
const seenBarcodes = new Set();
for (const row of rows) {
  const category = clean(row.description).toLowerCase();
  const tokens = category.split('.').map((t) => t.trim());
  if (!tokens.some((t) => SKIN.test(t)) || NOT_SKINCARE.test(category)) continue;
  const active = clean(row.active).toLowerCase();
  if (DRUG_ACTIVES.test(active)) continue;

  const raw = clean(row.barcode);
  let barcode = raw && validGtin(raw) ? storedForm(raw) : null;
  // A barcode shared by two listings can't tell them apart: keep the first, the other stays findable by name.
  if (barcode && seenBarcodes.has(barcode)) barcode = null;
  if (barcode) seenBarcodes.add(barcode);

  products.push({
    id: Number(row.id),
    name: clean(row.name),
    ar: clean(row.arabic),
    active,
    company: clean(row.company),
    barcode,
    category,
  });
}

const file = {
  source: 'Egyptian Drug Database (eg-drugs) by Mahmoud Mohamed',
  url: 'https://github.com/mahmoudfalous/eg-drugs',
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  commit: COMMIT,
  changes: 'Skincare products only; prices and indications removed; invalid barcodes dropped (scripts/import-eg-products.mjs).',
  generated: new Date().toISOString().slice(0, 10),
  products,
};
await writeFile(OUT, `${JSON.stringify(file, null, 0).replace(/\},\{/g, '},\n{')}\n`);
console.log(
  `eg-products: ${products.length} of ${rows.length} rows kept, ${products.filter((p) => p.barcode).length} with barcodes, ${products.filter((p) => p.active).length} with active ingredients -> ${path.relative(process.cwd(), OUT)}`,
);
