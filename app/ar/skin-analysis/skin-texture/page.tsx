import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { TOPIC_PAGES_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/skin-analysis/skin-texture', 'ar');

export default function ArabicTexturePage() {
  return <ContentLayout locale="ar" data={TOPIC_PAGES_CONTENT['skin-texture'].ar} />;
}

