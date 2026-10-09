import type { Metadata } from 'next';
import ScanApp from '@/components/ScanApp';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/scan', 'ar');

export default function ArabicScanPage() {
  return <ScanApp />;
}

