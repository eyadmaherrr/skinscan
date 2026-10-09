import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { ABOUT_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/about', 'en');

export default function AboutPage() {
  return <ContentLayout locale="en" data={ABOUT_CONTENT.en} />;
}

