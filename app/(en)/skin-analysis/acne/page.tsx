import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { TOPIC_PAGES_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/skin-analysis/acne', 'en');

export default function AcnePage() {
  return <ContentLayout locale="en" data={TOPIC_PAGES_CONTENT.acne.en} />;
}

