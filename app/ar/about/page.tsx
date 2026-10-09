import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { ABOUT_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/about', 'ar');

export default function ArabicAboutPage() {
  return <ContentLayout locale="ar" data={ABOUT_CONTENT.ar} />;
}

