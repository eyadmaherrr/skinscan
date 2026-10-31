import type { Metadata } from 'next';
import ProductScanApp from '@/components/ProductScanApp';
import { pageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = pageMetadata('/products', 'en');

export default function ProductsPage() {
  return <ProductScanApp />;
}
