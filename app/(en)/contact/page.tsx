import type { Metadata } from 'next';
import ContentLayout from '@/components/content/ContentLayout';
import { CONTACT_CONTENT } from '@/lib/content/pages-content';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/contact', 'en');

export default function ContactPage() {
  return <ContentLayout locale="en" data={CONTACT_CONTENT.en} />;
}

