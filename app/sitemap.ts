import type { MetadataRoute } from 'next';
import { PRODUCTION_URL } from '@/lib/brand';
import { publicConfig } from '@/lib/public-config';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (publicConfig.appUrl || PRODUCTION_URL).replace(/\/+$/, '');
  const now = new Date();

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}

