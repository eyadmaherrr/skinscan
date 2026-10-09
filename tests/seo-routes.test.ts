import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import {
  ABOUT_CONTENT,
  CONTACT_CONTENT,
  FEATURES_CONTENT,
  HOW_IT_WORKS_CONTENT,
  TOPIC_PAGES_CONTENT,
  TOPICS_INDEX,
} from '../lib/content/pages-content';
import {
  buildBreadcrumbSchema,
  buildMedicalOrganizationSchema,
  buildMedicalWebPageSchema,
  pageMetadata,
  ROUTE_METADATA,
} from '../lib/site-metadata';

describe('Multi-Page SEO Architecture & Metadata', () => {
  const routes = [
    '/',
    '/scan',
    '/about',
    '/how-it-works',
    '/features',
    '/skin-analysis',
    '/skin-analysis/pores',
    '/skin-analysis/acne',
    '/skin-analysis/pigmentation',
    '/skin-analysis/redness',
    '/skin-analysis/skin-texture',
    '/skin-analysis/skin-shine',
    '/skin-analysis/under-eye-darkness',
    '/contact',
    '/privacy',
    '/terms',
  ];

  it('provides complete, distinct metadata for all 16 routes in English and Arabic', () => {
    const enTitles = new Set<string>();
    const arTitles = new Set<string>();

    for (const route of routes) {
      assert.ok(ROUTE_METADATA[route], `Missing route definition: ${route}`);

      const enMeta = pageMetadata(route, 'en');
      const arMeta = pageMetadata(route, 'ar');

      // Titles must be defined, non-empty, and unique
      assert.ok(enMeta.title, `Missing EN title for ${route}`);
      assert.strictEqual(typeof enMeta.title, 'string');
      assert.notStrictEqual((enMeta.title as string).length, 0);
      enTitles.add(enMeta.title as string);

      assert.ok(arMeta.title, `Missing AR title for ${route}`);
      assert.strictEqual(typeof arMeta.title, 'string');
      assert.notStrictEqual((arMeta.title as string).length, 0);
      arTitles.add(arMeta.title as string);

      // Descriptions must be thorough
      assert.ok(enMeta.description);
      assert.ok((enMeta.description as string).length > 20);

      assert.ok(arMeta.description);
      assert.ok((arMeta.description as string).length > 20);

      // Alternates & hreflang
      assert.ok(enMeta.alternates?.canonical);
      assert.ok(enMeta.alternates?.languages?.en);
      assert.ok(enMeta.alternates?.languages?.ar);
      assert.ok(enMeta.alternates?.languages?.['x-default']);

      // OpenGraph
      assert.strictEqual(enMeta.openGraph?.title, enMeta.title);
      assert.strictEqual(enMeta.openGraph?.locale, 'en_US');
      assert.strictEqual(arMeta.openGraph?.locale, 'ar_EG');
    }

    // Uniqueness
    assert.strictEqual(enTitles.size, routes.length);
    assert.strictEqual(arTitles.size, routes.length);
  });

  it('generates valid Schema.org MedicalClinic structured data', () => {
    const enSchema = buildMedicalOrganizationSchema('en');
    assert.strictEqual(enSchema['@context'], 'https://schema.org');
    assert.strictEqual(enSchema['@type'], 'MedicalClinic');
    assert.ok(enSchema.name.includes('Dr. Maher Mahmoud'));

    const arSchema = buildMedicalOrganizationSchema('ar');
    assert.ok(arSchema.name.includes('د. ماهر محمود'));
  });

  it('generates valid Schema.org BreadcrumbList structured data', () => {
    const breadcrumbs = [
      { name: 'Home', path: '/' },
      { name: 'Skin Analysis', path: '/skin-analysis' },
      { name: 'Pores', path: '/skin-analysis/pores' },
    ];
    const schema = buildBreadcrumbSchema(breadcrumbs, 'en');

    assert.strictEqual(schema['@context'], 'https://schema.org');
    assert.strictEqual(schema['@type'], 'BreadcrumbList');
    assert.strictEqual(schema.itemListElement.length, 3);
    assert.strictEqual(schema.itemListElement[0].position, 1);
    assert.strictEqual(schema.itemListElement[0].name, 'Home');
    assert.strictEqual(schema.itemListElement[2].name, 'Pores');
    assert.ok(schema.itemListElement[2].item.includes('/skin-analysis/pores'));
  });

  it('generates valid Schema.org MedicalWebPage structured data', () => {
    const schema = buildMedicalWebPageSchema(
      'Facial Pores & Resolution',
      'Educational guide on facial pores',
      '/skin-analysis/pores',
      'en',
    );

    assert.strictEqual(schema['@context'], 'https://schema.org');
    assert.strictEqual(schema['@type'], 'MedicalWebPage');
    assert.strictEqual(schema.name, 'Facial Pores & Resolution');
    assert.strictEqual(schema.inLanguage, 'en');
    assert.ok(schema.url.includes('/skin-analysis/pores'));
  });

  it('compiles a comprehensive sitemap with all 16 bilingual routes (32 entries)', () => {
    const map = sitemap();
    assert.ok(map.length >= 32);

    for (const entry of map) {
      assert.ok(/^https?:\/\//.test(entry.url));
      assert.ok(entry.lastModified instanceof Date);
      assert.ok((entry.priority ?? 0) >= 0.5);
      assert.ok(entry.alternates?.languages?.en);
      assert.ok(entry.alternates?.languages?.ar);
    }

    const enUrls = map.filter((e) => !e.url.includes('/ar'));
    const arUrls = map.filter((e) => e.url.includes('/ar'));
    assert.strictEqual(enUrls.length, 16);
    assert.strictEqual(arUrls.length, 16);
  });

  it('enforces search engine robots policy with API disallowed', () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;

    assert.ok(rules);
    assert.strictEqual(rules?.userAgent, '*');
    assert.strictEqual(rules?.allow, '/');
    assert.ok(rules?.disallow?.includes('/api/'));
    assert.ok(/sitemap\.xml$/.test(r.sitemap as string));
  });

  it('guarantees complete educational content parity across all topics', () => {
    const checkContent = (dataEn: any, dataAr: any, slug: string) => {
      assert.strictEqual(dataEn.slug, slug);
      assert.strictEqual(dataAr.slug, slug);
      assert.ok(dataEn.title.length > 5);
      assert.ok(dataAr.title.length > 5);
      assert.ok(dataEn.sections.length >= 1);
      assert.ok(dataAr.sections.length >= 1);
      assert.ok(dataEn.breadcrumbs.length >= 2);
      assert.ok(dataAr.breadcrumbs.length >= 2);
    };

    checkContent(ABOUT_CONTENT.en, ABOUT_CONTENT.ar, '/about');
    checkContent(HOW_IT_WORKS_CONTENT.en, HOW_IT_WORKS_CONTENT.ar, '/how-it-works');
    checkContent(FEATURES_CONTENT.en, FEATURES_CONTENT.ar, '/features');
    checkContent(CONTACT_CONTENT.en, CONTACT_CONTENT.ar, '/contact');
    checkContent(TOPICS_INDEX.en, TOPICS_INDEX.ar, '/skin-analysis');

    const topics = [
      'pores',
      'acne',
      'pigmentation',
      'redness',
      'skin-texture',
      'skin-shine',
      'under-eye-darkness',
    ];

    for (const t of topics) {
      assert.ok(TOPIC_PAGES_CONTENT[t]);
      checkContent(
        TOPIC_PAGES_CONTENT[t].en,
        TOPIC_PAGES_CONTENT[t].ar,
        `/skin-analysis/${t}`,
      );
    }
  });
});
