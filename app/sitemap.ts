import type { MetadataRoute } from 'next';
import { PRODUCTION_URL } from '@/lib/brand';
import { localePath } from '@/lib/i18n';
import { publicConfig } from '@/lib/public-config';

const PAGES = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/terms', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/privacy', changeFrequency: 'monthly', priority: 0.5 },
] as const;

/** Every page in English and Arabic, each listing the other language. */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (publicConfig.appUrl || PRODUCTION_URL).replace(/\/+$/, '');
  const now = new Date();
  return PAGES.flatMap(({ path, changeFrequency, priority }) => {
    const languages = { en: `${baseUrl}${path}`, ar: `${baseUrl}${localePath(path, 'ar')}` };
    return (['en', 'ar'] as const).map((locale) => ({
      url: languages[locale],
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  });
}
