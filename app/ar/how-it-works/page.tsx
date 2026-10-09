import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { HOW_IT_WORKS_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/how-it-works', 'ar');

export default function ArabicHowItWorksPage() {
  return <ContentLayout locale="ar" data={HOW_IT_WORKS_CONTENT.ar} />;
}

