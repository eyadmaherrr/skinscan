import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { TOPIC_PAGES_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/skin-analysis/under-eye-darkness', 'en');

export default function UnderEyePage() {
  return <ContentLayout locale="en" data={TOPIC_PAGES_CONTENT['under-eye-darkness'].en} />;
}

