import type { MetadataRoute } from 'next';
import { PRODUCTION_URL } from '@/lib/brand';
import { publicConfig } from '@/lib/public-config';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (publicConfig.appUrl || PRODUCTION_URL).replace(/\/+$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
