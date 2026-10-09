import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { FEATURES_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/features', 'ar');

export default function ArabicFeaturesPage() {
  return <ContentLayout locale="ar" data={FEATURES_CONTENT.ar} />;
}

