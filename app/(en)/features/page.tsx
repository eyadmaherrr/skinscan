import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { FEATURES_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/features', 'en');

export default function FeaturesPage() {
  return <ContentLayout locale="en" data={FEATURES_CONTENT.en} />;
}

