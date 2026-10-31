import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { messages } from '../lib/messages';
import { expandUpcE, normalizeBarcode } from '../lib/products/barcode';
import {
  BENEFIT_KEYS,
  benefitSummary,
  INGREDIENT_KEYS,
  INGREDIENTS,
  looksLikeSunscreen,
  matchIngredients,
  splitIngredients,
} from '../lib/products/ingredients';

describe('barcodes', () => {
  it('accepts valid retail barcodes in the form the database stores them', () => {
    assert.equal(normalizeBarcode('3337875597197'), '3337875597197'); // EAN-13
    assert.equal(normalizeBarcode('3337 8755-97197'), '3337875597197'); // spaces and dashes
    assert.equal(normalizeBarcode('036000291452'), '0036000291452'); // UPC-A → GTIN-13
    assert.equal(normalizeBarcode('96385074'), '96385074'); // EAN-8 stays 8 digits
    assert.equal(normalizeBarcode('00036000291452'), '0036000291452'); // GTIN-14 with a leading 0
  });

  it('expands UPC-E', () => {
    assert.equal(expandUpcE('04252614'), '042100005264');
    assert.equal(normalizeBarcode('04252614', 'upc_e'), '0042100005264');
  });

  it('rejects wrong check digits, letters and odd lengths', () => {
    assert.equal(normalizeBarcode('3337875597198'), null);
    assert.equal(normalizeBarcode('33378755971AB'), null);
    assert.equal(normalizeBarcode('12345'), null);
    assert.equal(normalizeBarcode(''), null);
    assert.equal(normalizeBarcode('1'.repeat(20)), null);
  });
});

describe('ingredient descriptions', () => {
  it('has a source and at least one benefit for every ingredient, and only known benefits', () => {
    for (const key of INGREDIENT_KEYS) {
      const rule = INGREDIENTS[key];
      assert.ok(rule.sources.length > 0, key);
      assert.ok(rule.benefits.length > 0, key);
      for (const source of rule.sources) assert.match(source.url, /^https:\/\/(pubmed\.ncbi\.nlm\.nih\.gov|eur-lex\.europa\.eu)\//, key);
      for (const benefit of rule.benefits) assert.ok(BENEFIT_KEYS.includes(benefit), `${key}: ${benefit}`);
    }
  });

  it('names every ingredient and benefit in both languages', () => {
    for (const locale of ['en', 'ar'] as const) {
      const t = messages(locale).product;
      for (const key of INGREDIENT_KEYS) assert.ok(t.ingredients[key], `${locale} ${key}`);
      for (const key of BENEFIT_KEYS) assert.ok(t.benefits[key], `${locale} ${key}`);
    }
  });

  it('splits a printed ingredient list into names', () => {
    const names = splitIngredients('AQUA/WATER/EAU, Sodium Hyaluronate (Hyaluronic Acid), Niacinamide 5%; CERAMIDE NP*').map((n) => n.name);
    assert.deepEqual(names, ['aqua', 'water', 'eau', 'sodium hyaluronate', 'hyaluronic acid', 'niacinamide', 'ceramide np']);
  });

  it('describes well-established ingredients in label order', () => {
    const { listed, matches } = matchIngredients({
      text: 'Aqua, Glycerin, Niacinamide, Salicylic Acid, Ceramide NP, Ceramide AP, Sodium Hyaluronate, Phenoxyethanol',
    });
    assert.equal(listed, 8);
    assert.deepEqual(
      matches.map((m) => m.key),
      ['glycerin', 'niacinamide', 'salicylicAcid', 'ceramides', 'hyaluronicAcid'],
    );
    assert.equal(matches.find((m) => m.key === 'ceramides')?.asListed, 'Ceramide NP');
    assert.deepEqual(matches.find((m) => m.key === 'niacinamide')?.benefits, ['redness', 'unevenTone', 'barrier']);
  });

  it('matches whole ingredient names only', () => {
    // "ethylhexyl salicylate" is a UV filter, not salicylic acid; "retinyl palmitate" is not in the table.
    const { matches } = matchIngredients({ text: 'Ethylhexyl Salicylate, Retinyl Palmitate, Ascorbyl Palmitate' });
    assert.deepEqual(
      matches.map((m) => m.key),
      ['uvFilter'],
    );
  });

  it('uses database tags for names the text lacks', () => {
    const { matches } = matchIngredients({ text: null, tags: ['en:aqua', 'en:niacinamide', 'fr:acide-azelaique', 'en:azelaic-acid'] });
    assert.deepEqual(
      matches.map((m) => m.key),
      ['niacinamide', 'azelaicAcid'],
    );
  });

  it('counts titanium dioxide and zinc oxide as UV filters only in sunscreens', () => {
    const makeup = matchIngredients({ text: 'Talc, Mica, Titanium Dioxide, Zinc Oxide' });
    assert.deepEqual(makeup.matches, []);
    const labelled = matchIngredients({ text: 'Aqua, Zinc Oxide', sunscreen: true });
    assert.deepEqual(
      labelled.matches.map((m) => m.key),
      ['mineralUvFilter'],
    );
    const withFilter = matchIngredients({ text: 'Aqua, Titanium Dioxide, Octocrylene' });
    assert.deepEqual(
      withFilter.matches.map((m) => m.key),
      ['mineralUvFilter', 'uvFilter'],
    );
    assert.ok(looksLikeSunscreen('Anthelios UVMune 400 SPF50+'));
    assert.ok(looksLikeSunscreen(null, 'en:sunscreens'));
    assert.ok(!looksLikeSunscreen('Foaming Cleanser', 'en:facial-cleanser'));
  });

  it('invents nothing when there is no ingredient list', () => {
    assert.deepEqual(matchIngredients({ text: null, tags: [] }), { listed: 0, matches: [] });
    assert.deepEqual(matchIngredients({ text: '   ' }), { listed: 0, matches: [] });
  });

  it('lists each benefit once with the ingredients it comes from', () => {
    const { matches } = matchIngredients({ text: 'Niacinamide, Azelaic Acid, Glycerin' });
    assert.deepEqual(benefitSummary(matches), [
      { benefit: 'blemishes', from: ['azelaicAcid'] },
      { benefit: 'redness', from: ['niacinamide', 'azelaicAcid'] },
      { benefit: 'unevenTone', from: ['niacinamide', 'azelaicAcid'] },
      { benefit: 'hydration', from: ['glycerin'] },
      { benefit: 'barrier', from: ['niacinamide'] },
    ]);
  });
});
