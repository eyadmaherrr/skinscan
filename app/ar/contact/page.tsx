import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { CONTACT_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/contact', 'ar');

export default function ArabicContactPage() {
  return <ContentLayout locale="ar" data={CONTACT_CONTENT.ar} />;
}

