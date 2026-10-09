import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { TOPIC_PAGES_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/skin-analysis/pigmentation', 'en');

export default function PigmentationPage() {
  return <ContentLayout locale="en" data={TOPIC_PAGES_CONTENT.pigmentation.en} />;
}

