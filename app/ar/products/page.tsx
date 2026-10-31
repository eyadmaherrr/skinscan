import type { Metadata } from 'next';
import ProductScanApp from '@/components/ProductScanApp';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/products', 'ar');

export default function ArabicProductsPage() {
  return <ProductScanApp />;
}
