import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { TOPIC_PAGES_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/skin-analysis/redness', 'en');

export default function RednessPage() {
  return <ContentLayout locale="en" data={TOPIC_PAGES_CONTENT.redness.en} />;
}

