import type { Metadata } from 'next';
import ScanApp from '@/components/ScanApp';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/scan', 'en');

export default function ScanPage() {
  return <ScanApp />;
}

