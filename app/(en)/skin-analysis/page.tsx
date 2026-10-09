import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { TOPICS_INDEX } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/skin-analysis', 'en');

export default function SkinAnalysisHubPage() {
  return <ContentLayout locale="en" data={TOPICS_INDEX.en} />;
}

