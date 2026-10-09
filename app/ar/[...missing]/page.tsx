import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { messages } from '@/lib/messages';

/** Any other URL: a 404 inside this language's layout (see not-found.tsx). */
export const metadata: Metadata = {
  title: `${messages('ar').status.notFound.meta} | ${messages('ar').siteName}`,
};

export default function Missing() {
  notFound();
}
