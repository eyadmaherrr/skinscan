import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { HOW_IT_WORKS_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/how-it-works', 'en');

export default function HowItWorksPage() {
  return <ContentLayout locale="en" data={HOW_IT_WORKS_CONTENT.en} />;
}

