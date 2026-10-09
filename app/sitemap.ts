import type { MetadataRoute } from 'next';
import { PRODUCTION_URL } from '@/lib/brand';
import { localePath } from '@/lib/i18n';
import { publicConfig } from '@/lib/public-config';

interface SitemapEntry {
  path: string;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

const PAGES: readonly SitemapEntry[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/scan', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/how-it-works', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/features', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/skin-analysis', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/skin-analysis/pores', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/skin-analysis/acne', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/skin-analysis/pigmentation', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/skin-analysis/redness', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/skin-analysis/skin-texture', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/skin-analysis/skin-shine', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/skin-analysis/under-eye-darkness', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/terms', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/privacy', changeFrequency: 'monthly', priority: 0.5 },
] as const;

/** Every page in English and Arabic, each listing the other language. */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (publicConfig.appUrl || PRODUCTION_URL).replace(/\/+$/, '');
  const now = new Date();

  return PAGES.flatMap(({ path, changeFrequency, priority }) => {
    const languages = {
      en: `${baseUrl}${path}`,
      ar: `${baseUrl}${localePath(path, 'ar')}`,
    };
    return (['en', 'ar'] as const).map((locale) => ({
      url: languages[locale],
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  });
}
